import { inject, injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { InventoryItem } from '../interfaces/Inventory';
import { EnrichedMarketListing, MarketListing, MarketListingStatus } from '../interfaces/MarketListing';
import { MarketListingRepository } from '../repositories/MarketListingRepository';
import { IBuyOrderService } from "./BuyOrderService";
import { DatabaseService } from './DatabaseService';

export interface IMarketListingService {
    createMarketListing(sellerId: string, inventoryItem: InventoryItem, sellingPrice: number): Promise<MarketListing>;
    cancelMarketListing(listingId: string, sellerId: string): Promise<void>;
    buyMarketListing(listingId: string, buyerId: string): Promise<MarketListing>;
    getMarketListingsByUser(userId: string): Promise<EnrichedMarketListing[]>;
    getActiveListingsForItem(itemId: string): Promise<MarketListing[]>;
    getMarketListingById(listingId: string): Promise<MarketListing | null>;
    getEnrichedMarketListings(limit?: number, offset?: number): Promise<EnrichedMarketListing[]>;
    searchMarketListings(searchTerm: string, limit?: number): Promise<EnrichedMarketListing[]>;
}

@injectable()
export class MarketListingService implements IMarketListingService {
    private marketListingRepository: MarketListingRepository;

    constructor(
        @inject('DatabaseService') private databaseService: DatabaseService,
        @inject('BuyOrderService') private buyOrderService: IBuyOrderService
    ) {
        this.marketListingRepository = new MarketListingRepository(this.databaseService);
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

        await this.marketListingRepository.insertMarketListing(marketListing);

        if (inventoryItem.metadata && inventoryItem.metadata._unique_id && typeof inventoryItem.metadata._unique_id === 'string') {
            await this.marketListingRepository.removeInventoryItemByUniqueId(sellerId, inventoryItem.item_id, inventoryItem.metadata._unique_id);
        } else if (inventoryItem.purchasePrice) {
            await this.marketListingRepository.updateInventoryAmountOrDelete(sellerId, inventoryItem.item_id, inventoryItem.purchasePrice);
        } else {
            await this.marketListingRepository.decrementOrDeleteInventory(sellerId, inventoryItem.item_id);
        }

        const matchedBuyOrder = await this.buyOrderService.matchSellOrder(marketListing.item_id, marketListing.price);
        if (matchedBuyOrder) {
            await this.marketListingRepository.updateBuyOrderToFulfilled(matchedBuyOrder.id, now);
            await this.buyMarketListing(marketListing.id, matchedBuyOrder.buyer_id);
        }
        return marketListing;
    }

    /**
     * Annule un ordre de vente et remet l'item dans l'inventaire du vendeur
     */
    async cancelMarketListing(listingId: string, sellerId: string): Promise<void> {
        const listing = await this.marketListingRepository.getMarketListingById(listingId, sellerId);
        if (!listing) throw new Error('Market listing not found or already processed');
        const metadata = typeof listing.metadata === 'string'
            ? JSON.parse(listing.metadata)
            : (listing.metadata || {});
        await this.marketListingRepository.updateMarketListingStatus(listingId, 'cancelled', new Date().toISOString());
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
        await this.marketListingRepository.addItemToInventory(inventoryItem);
    }

    async buyMarketListing(listingId: string, buyerId: string): Promise<MarketListing> {
        const now = new Date().toISOString();
        const listing = await this.marketListingRepository.getMarketListingById(listingId);
        if (!listing) throw new Error('Market listing not found or already sold');
        // (Vérification crédits à faire côté controller/service appelant)
        await this.marketListingRepository.updateMarketListingSold(listingId, buyerId, now);
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
        await this.marketListingRepository.addItemToInventory(inventoryItem);
        return { ...listing, status: 'sold', buyer_id: buyerId, sold_at: now };
    }

    /**
     * Récupère tous les ordres de vente d'un utilisateur
     */
    async getMarketListingsByUser(userId: string): Promise<EnrichedMarketListing[]> {
        const listings = await this.marketListingRepository.getMarketListingsByUser(userId);
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
        const listings = await this.marketListingRepository.getActiveListingsForItem(itemId);
        return listings.map(this.deserializeMarketListing);
    }

    /**
     * Récupère un ordre de vente par son ID
     */
    async getMarketListingById(listingId: string): Promise<MarketListing | null> {
        const listing = await this.marketListingRepository.getMarketListingByIdAnyStatus(listingId);
        return listing ? this.deserializeMarketListing(listing) : null;
    }

    /**
     * Récupère les ordres de vente enrichis avec les détails des items
     */
    async getEnrichedMarketListings(limit: number = 50, offset: number = 0): Promise<EnrichedMarketListing[]> {
        const listings = await this.marketListingRepository.getEnrichedMarketListings(limit, offset);
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
        const listings = await this.marketListingRepository.searchMarketListings(searchTerm, limit);
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
    private deserializeMarketListing = (row: MarketListing): MarketListing => ({
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
    });

    /**
     * Méthode helper pour ajouter un item à l'inventaire (comme dans TradeService)
     */
    // ...existing code...
}