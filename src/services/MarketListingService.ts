import { v4 as uuidv4 } from 'uuid';
import { InventoryItem } from '../interfaces/Inventory';
import { MarketListing, MarketListingStatus, EnrichedMarketListing } from '../interfaces/MarketListing';
import { DatabaseService } from './DatabaseService';
import { inject, injectable } from 'inversify';
import { IBuyOrderService } from "./BuyOrderService";

export interface IMarketListingService {
    createMarketListing(...args: unknown[]): Promise<unknown>;
    cancelMarketListing(...args: unknown[]): Promise<unknown>;
    buyMarketListing(listingId: string, buyerId: string): Promise<MarketListing>;
    getMarketListingsByUser(userId: string): Promise<MarketListing[]>;
    getActiveListingsForItem(itemId: string): Promise<MarketListing[]>;
    getMarketListingById(listingId: string): Promise<MarketListing | null>;
    getEnrichedMarketListings(limit?: number, offset?: number): Promise<EnrichedMarketListing[]>;
    searchMarketListings(searchTerm: string, limit?: number): Promise<EnrichedMarketListing[]>;
}

@injectable()
export class MarketListingService implements IMarketListingService {

    constructor(
        @inject('DatabaseService') private databaseService: DatabaseService,
        @inject('BuyOrderService') private buyOrderService: IBuyOrderService
    ) {
    }

    /**
     * Met un item de l'inventaire en vente sur le marketplace
     * L'item est retiré de l'inventaire et ajouté aux ordres de vente
     */
    async createMarketListing(
        sellerId: string,
        inventoryItem: InventoryItem,
        sellingPrice: number
    ): Promise<MarketListing> {
        const now = new Date().toISOString();

        // Vérifications préliminaires
        if (!inventoryItem.sellable && !inventoryItem.metadata) {
            throw new Error('This item cannot be sold');
        }

        if (inventoryItem.user_id !== sellerId) {
            throw new Error('You do not own this item');
        }

        if (inventoryItem.amount < 1) {
            throw new Error('Not enough quantity to sell');
        }

        if (sellingPrice <= 0) {
            throw new Error('Selling price must be positive');
        }

        // Création de l'ordre de vente
        const marketListing: MarketListing = {
            id: uuidv4(),
            seller_id: sellerId,
            item_id: inventoryItem.item_id,
            price: sellingPrice,
            purchasePrice: inventoryItem.purchasePrice || undefined,
            status: 'active' as MarketListingStatus,
            metadata: inventoryItem.metadata,
            created_at: now,
            updated_at: now,
            rarity: inventoryItem.rarity || 'common',
            custom_url_link: inventoryItem.custom_url_link || undefined
        };

        try {
            // 1. Ajouter l'ordre de vente (correction: utiliser create au lieu de read)
            await this.databaseService.request(
                `INSERT INTO market_listings (id, seller_id, item_id, price, status, metadata, created_at, updated_at, purchasePrice) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    marketListing.id,
                    marketListing.seller_id,
                    marketListing.item_id,
                    marketListing.price,
                    marketListing.status,
                    JSON.stringify(marketListing.metadata || {}),
                    marketListing.created_at,
                    marketListing.updated_at,
                    marketListing.purchasePrice
                ]
            );

            // 2. Retirer l'item de l'inventaire
            if (inventoryItem.metadata && inventoryItem.metadata._unique_id) {
                // Item unique avec _unique_id
                await this.databaseService.request(
                    `DELETE FROM inventories 
                     WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
                    [sellerId, inventoryItem.item_id, inventoryItem.metadata._unique_id]
                );
            } else if (inventoryItem.purchasePrice) {
                // Item identifié par purchasePrice
                // Si amount > 1, décrémenter, sinon supprimer l'entrée
                const result = await this.databaseService.read<{ amount: number }>(
                    `SELECT amount FROM inventories WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`,
                    [sellerId, inventoryItem.item_id, inventoryItem.purchasePrice]
                );
                if (result.length > 0 && result[0].amount > 1) {
                    await this.databaseService.request(
                        `UPDATE inventories SET amount = amount - 1 WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`,
                        [sellerId, inventoryItem.item_id, inventoryItem.purchasePrice]
                    );
                } else {
                    await this.databaseService.request(
                        `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`,
                        [sellerId, inventoryItem.item_id, inventoryItem.purchasePrice]
                    );
                }
            } else {
                // Item ordinaire sans métadonnées spécifiques
                await this.databaseService.request(
                    `UPDATE inventories 
         SET amount = amount - 1 
         WHERE user_id = ? AND item_id = ? AND amount > 0`,
                    [sellerId, inventoryItem.item_id]
                );

                // Supprimer l'entrée si la quantité devient 0
                await this.databaseService.request(
                    `DELETE FROM inventories 
         WHERE user_id = ? AND item_id = ? AND amount = 0`,
                    [sellerId, inventoryItem.item_id]
                );
            }

            // Tentative de matching automatique avec un buy order
            const matchedBuyOrder = await this.buyOrderService.matchSellOrder(
                marketListing.item_id,
                marketListing.price
            );

            if (matchedBuyOrder) {
                // 1. Marquer le buy order comme fulfilled (ou décrémenter amount si > 1)
                await this.databaseService.request(
                    `UPDATE buy_orders SET status = 'fulfilled', fulfilled_at = ?, updated_at = ? WHERE id = ?`,
                    [now, now, matchedBuyOrder.id]
                );

                // 2. Effectuer la vente automatiquement (transfert item, crédits, etc.)
                await this.buyMarketListing(marketListing.id, matchedBuyOrder.buyer_id);
                // Tu peux notifier les deux utilisateurs ici si besoin
            }

            return marketListing;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error while creating the market listing: ${error.message}`);
            } else {
                throw new Error(`Error while creating the market listing: ${String(error)}`);
            }
        }
    }

    /**
     * Annule un ordre de vente et remet l'item dans l'inventaire du vendeur
     */
    async cancelMarketListing(listingId: string, sellerId: string): Promise<void> {
        try {
            // 1. Récupérer l'ordre de vente
            const listingResult = await this.databaseService.read<MarketListing>(
                `SELECT * FROM market_listings WHERE id = ? AND seller_id = ? AND status = 'active'`,
                [listingId, sellerId]
            );

            if (listingResult.length === 0) {
                throw new Error('Market listing not found or already processed');
            }

            const listing = listingResult[0];
            const metadata = JSON.parse(typeof listing.metadata === 'string' ? listing.metadata : JSON.stringify(listing.metadata || {}));

            // 2. Marquer l'ordre comme annulé
            await this.databaseService.request(
                `UPDATE market_listings SET status = 'cancelled', updated_at = ? WHERE id = ?`,
                [new Date().toISOString(), listingId]
            );

            // 3. Remettre l'item dans l'inventaire
            const inventoryItem: InventoryItem = {
                user_id: sellerId,
                item_id: listing.item_id,
                amount: 1,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
                sellable: true,
                purchasePrice: listing.purchasePrice || undefined,
                rarity: listing.rarity,
                custom_url_link: listing.custom_url_link || undefined
            };

            await this.addItemToInventory(inventoryItem);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error while cancelling the market listing: ${error.message}`);
            } else {
                throw new Error(`Error while cancelling the market listing: ${String(error)}`);
            }
        }
    }

    async buyMarketListing(listingId: string, buyerId: string): Promise<MarketListing> {
        const now = new Date().toISOString();

        // 1. Récupérer l'ordre de vente
        const listingResult = await this.databaseService.read<MarketListing>(
            `SELECT * FROM market_listings WHERE id = ? AND status = 'active'`,
            [listingId]
        );

        if (listingResult.length === 0) {
            throw new Error('Market listing not found or already sold');
        }

        const listing = listingResult[0];

        // 2. Vérifier si l'acheteur a assez de crédits
        const buyerCreditsResult = await this.databaseService.read<{ balance: number }>(
            `SELECT balance FROM users WHERE user_id = ?`,
            [buyerId]
        );

        if (buyerCreditsResult.length === 0 || buyerCreditsResult[0].balance < listing.price) {
            throw new Error('Not enough balance to buy this item');
        }

        // 3. Débiter les crédits de l'acheteur
        await this.databaseService.request(
            `UPDATE users SET balance = balance - ? WHERE user_id = ?`,
            [listing.price, buyerId]
        );

        // Ajouter 75% des crédits au vendeur
        const sellerCreditsResult = await this.databaseService.read<{ balance: number }>(
            `SELECT balance FROM users WHERE user_id = ?`,
            [listing.seller_id]
        );

        if (sellerCreditsResult.length === 0) {
            throw new Error('Seller not found');
        }

        const amountToAdd = Math.floor(listing.price * 0.75);

        await this.databaseService.request(
            `UPDATE users SET balance = balance + ? WHERE user_id = ?`,
            [amountToAdd, listing.seller_id]
        );

        // 4. Marquer l'ordre de vente comme vendu
        await this.databaseService.request(
            `UPDATE market_listings SET status = 'sold', buyer_id = ?, sold_at = ?, updated_at = ? WHERE id = ?`,
            [buyerId, now, now, listingId]
        );

        // 5. Ajouter l'item à l'inventaire de l'acheteur
        const inventoryItem: InventoryItem = {
            user_id: buyerId,
            item_id: listing.item_id,
            amount: 1,
            metadata: listing.metadata,
            sellable: true,
            purchasePrice: listing.purchasePrice || undefined,
            rarity: listing.rarity || "common",
            custom_url_link: listing.custom_url_link
        };

        await this.addItemToInventory(inventoryItem);

        return { ...listing, status: 'sold', buyer_id: buyerId, sold_at: now };
    }

    /**
     * Récupère tous les ordres de vente d'un utilisateur
     */
    async getMarketListingsByUser(userId: string): Promise<EnrichedMarketListing[]> {
        const listings = await this.databaseService.read<EnrichedMarketListing>(
            `SELECT 
                ml.*,
                i.name as item_name,
                i.description as item_description,
                i.iconHash as item_icon_hash
             FROM market_listings ml
             JOIN items i ON ml.item_id = i.itemId
             WHERE ml.seller_id = ?
             ORDER BY ml.created_at DESC`,
            [userId]
        );

        return listings.map(row => ({
            ...this.deserializeMarketListing(row),
            item_name: row.item_name,
            item_description: row.item_description,
            item_icon_hash: row.item_icon_hash
        }));
    }

    /**
     * Récupère tous les ordres de vente actifs pour un item spécifique
     */
    async getActiveListingsForItem(itemId: string): Promise<MarketListing[]> {
        const listings = await this.databaseService.read<MarketListing>(
            `SELECT * FROM market_listings WHERE item_id = ? AND status = 'active' ORDER BY price ASC, created_at ASC`,
            [itemId]
        );
        return listings.map(this.deserializeMarketListing);
    }

    /**
     * Récupère un ordre de vente par son ID
     */
    async getMarketListingById(listingId: string): Promise<MarketListing | null> {
        const listings = await this.databaseService.read<MarketListing>(
            `SELECT * FROM market_listings WHERE id = ?`,
            [listingId]
        );
        if (listings.length === 0) return null;
        return this.deserializeMarketListing(listings[0]);
    }

    /**
     * Récupère les ordres de vente enrichis avec les détails des items
     */
    async getEnrichedMarketListings(limit: number = 50, offset: number = 0): Promise<EnrichedMarketListing[]> {
        const listings = await this.databaseService.read<EnrichedMarketListing>(
            `SELECT 
                ml.*,
                i.name as item_name,
                i.description as item_description,
                i.iconHash as item_icon_hash
             FROM market_listings ml
             JOIN items i ON ml.item_id = i.itemId
             WHERE ml.status = 'active' AND (i.deleted IS NULL OR i.deleted = 0)
             ORDER BY ml.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return listings.map(row => ({
            ...this.deserializeMarketListing(row),
            item_name: row.item_name,
            item_description: row.item_description,
            item_icon_hash: row.item_icon_hash
        }));
    }

    /**
     * Recherche d'ordres de vente par nom d'item
     */
    async searchMarketListings(searchTerm: string, limit: number = 50): Promise<EnrichedMarketListing[]> {
        const listings = await this.databaseService.read<EnrichedMarketListing>(
            `SELECT 
                ml.*,
                i.name as item_name,
                i.description as item_description,
                i.iconHash as item_icon_hash
             FROM market_listings ml
             JOIN items i ON ml.item_id = i.itemId
             WHERE ml.status = 'active' 
               AND (i.deleted IS NULL OR i.deleted = 0)
               AND i.name LIKE ?
             ORDER BY ml.price ASC, ml.created_at ASC
             LIMIT ?`,
            [`%${searchTerm}%`, limit]
        );

        return listings.map(row => ({
            ...this.deserializeMarketListing(row),
            item_name: row.item_name,
            item_description: row.item_description,
            item_icon_hash: row.item_icon_hash
        }));
    }

    /**
     * Désérialise une ligne de la base de données en MarketListing
     */
    private deserializeMarketListing = (row: MarketListing): MarketListing => {
        const listing: MarketListing = {
            id: row.id,
            seller_id: row.seller_id,
            item_id: row.item_id,
            price: row.price,
            status: row.status,
            metadata: row.metadata,
            created_at: row.created_at,
            updated_at: row.updated_at,
            sold_at: row.sold_at || undefined,
            buyer_id: row.buyer_id || undefined,
            rarity: row.rarity || 'common',
            custom_url_link: row.custom_url_link || undefined
        };
        return listing;
    }

    /**
     * Méthode helper pour ajouter un item à l'inventaire (comme dans TradeService)
     */
    private async addItemToInventory(inventoryItem: InventoryItem): Promise<void> {
        if (inventoryItem.metadata && inventoryItem.metadata._unique_id) {
            // Item unique - créer une nouvelle entrée
            await this.databaseService.request(
                `INSERT INTO inventories (user_id, item_id, amount, ${inventoryItem.metadata && Object.keys(inventoryItem.metadata).length > 0 ? 'metadata, ' : ''}sellable, purchasePrice) 
                 VALUES (?, ?, ?, ${inventoryItem.metadata && Object.keys(inventoryItem.metadata).length > 0 ? '?, ' : ''}?, ?)`,

                [
                    inventoryItem.user_id,
                    inventoryItem.item_id,
                    inventoryItem.amount,
                    ...(inventoryItem.metadata && Object.keys(inventoryItem.metadata).length > 0
                        ? [JSON.stringify(inventoryItem.metadata)]
                        : []),
                    inventoryItem.sellable,
                    inventoryItem.purchasePrice
                ]
            );
        } else {
            // Item ordinaire - incrémenter ou créer
            const existingResult = await this.databaseService.read(
                `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`,
                [inventoryItem.user_id, inventoryItem.item_id, inventoryItem.purchasePrice || null]
            );

            if (existingResult.length > 0) {
                await this.databaseService.request(
                    `UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`,
                    [inventoryItem.amount, inventoryItem.user_id, inventoryItem.item_id, inventoryItem.purchasePrice || null]
                );
            } else {
                await this.databaseService.request(
                    `INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        inventoryItem.user_id,
                        inventoryItem.item_id,
                        inventoryItem.amount,
                        null,
                        inventoryItem.sellable,
                        inventoryItem.purchasePrice
                    ]
                );
            }
        }
    }
}