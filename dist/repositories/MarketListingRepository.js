"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketListingRepository = void 0;
class MarketListingRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async insertMarketListing(listing) {
        await this.databaseService.request(`INSERT INTO market_listings (id, seller_id, item_id, price, status, metadata, created_at, updated_at, purchasePrice) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [listing.id, listing.seller_id, listing.item_id, listing.price, listing.status, JSON.stringify(listing.metadata || {}), listing.created_at, listing.updated_at, listing.purchasePrice]);
    }
    // --- INVENTORY HELPERS ---
    async removeInventoryItemByUniqueId(userId, itemId, uniqueId) {
        await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`, [userId, itemId, uniqueId]);
    }
    async updateInventoryAmountOrDelete(userId, itemId, purchasePrice) {
        const [row] = await this.databaseService.read(`SELECT amount FROM inventories WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`, [userId, itemId, purchasePrice]);
        if (row && row.amount > 1) {
            await this.databaseService.request(`UPDATE inventories SET amount = amount - 1 WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`, [userId, itemId, purchasePrice]);
        }
        else {
            await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`, [userId, itemId, purchasePrice]);
        }
    }
    async decrementOrDeleteInventory(userId, itemId) {
        await this.databaseService.request(`UPDATE inventories SET amount = amount - 1 WHERE user_id = ? AND item_id = ? AND amount > 0`, [userId, itemId]);
        await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND amount = 0`, [userId, itemId]);
    }
    // --- MARKET LISTING GENERIC GETTER ---
    async getMarketListings(filters = {}, select = '*', orderBy = 'created_at DESC', limit) {
        let query = `SELECT ${select} FROM market_listings WHERE 1=1`;
        const params = [];
        if (filters.id) {
            query += ' AND id = ?';
            params.push(filters.id);
        }
        if (filters.sellerId) {
            query += ' AND seller_id = ?';
            params.push(filters.sellerId);
        }
        if (filters.itemId) {
            query += ' AND item_id = ?';
            params.push(filters.itemId);
        }
        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }
        query += ` ORDER BY ${orderBy}`;
        if (limit)
            query += ` LIMIT ${limit}`;
        return this.databaseService.read(query, params);
    }
    // --- Surcharges utilisant la méthode générique ---
    async getMarketListingById(listingId, sellerId) {
        const listings = await this.getMarketListings({ id: listingId, sellerId, status: 'active' });
        return listings[0] || null;
    }
    async getMarketListingByIdAnyStatus(listingId) {
        const listings = await this.getMarketListings({ id: listingId });
        return listings[0] || null;
    }
    async getMarketListingsByUser(userId) {
        return this.databaseService.read(`SELECT 
                ml.*,
                i.name as item_name,
                i.description as item_description,
                i.iconHash as item_icon_hash
             FROM market_listings ml
             JOIN items i ON ml.item_id = i.itemId
             WHERE ml.seller_id = ?
             ORDER BY ml.created_at DESC`, [userId]);
    }
    async getActiveListingsForItem(itemId) {
        return this.getMarketListings({ itemId, status: 'active' }, '*', 'price ASC, created_at ASC');
    }
    async getEnrichedMarketListings(limit, offset) {
        return this.databaseService.read(`SELECT 
                ml.*,
                i.name as item_name,
                i.description as item_description,
                i.iconHash as item_icon_hash
             FROM market_listings ml
             JOIN items i ON ml.item_id = i.itemId
             WHERE ml.status = 'active' AND (i.deleted IS NULL OR i.deleted = 0)
             ORDER BY ml.created_at DESC
             LIMIT ? OFFSET ?`, [limit, offset]);
    }
    async searchMarketListings(searchTerm, limit) {
        return this.databaseService.read(`SELECT 
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
             LIMIT ?`, [`%${searchTerm}%`, limit]);
    }
    // --- UPDATE STATUS ---
    async updateMarketListingStatus(listingId, status, updatedAt) {
        await this.databaseService.request(`UPDATE market_listings SET status = ?, updated_at = ? WHERE id = ?`, [status, updatedAt, listingId]);
    }
    async updateMarketListingSold(listingId, buyerId, now) {
        await this.databaseService.request(`UPDATE market_listings SET status = 'sold', buyer_id = ?, sold_at = ?, updated_at = ? WHERE id = ?`, [buyerId, now, now, listingId]);
    }
    async updateBuyOrderToFulfilled(buyOrderId, now) {
        await this.databaseService.request(`UPDATE buy_orders SET status = 'fulfilled', fulfilled_at = ?, updated_at = ? WHERE id = ?`, [now, now, buyOrderId]);
    }
    // --- INVENTORY ADD ---
    async addItemToInventory(inventoryItem) {
        if (inventoryItem.metadata && inventoryItem.metadata._unique_id) {
            await this.databaseService.request(`INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)`, [inventoryItem.user_id, inventoryItem.item_id, inventoryItem.amount, JSON.stringify(inventoryItem.metadata), inventoryItem.sellable, inventoryItem.purchasePrice]);
        }
        else {
            const existingResult = await this.databaseService.read(`SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`, [inventoryItem.user_id, inventoryItem.item_id, inventoryItem.purchasePrice || null]);
            if (existingResult.length > 0) {
                await this.databaseService.request(`UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`, [inventoryItem.amount, inventoryItem.user_id, inventoryItem.item_id, inventoryItem.purchasePrice || null]);
            }
            else {
                await this.databaseService.request(`INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)`, [inventoryItem.user_id, inventoryItem.item_id, inventoryItem.amount, null, inventoryItem.sellable, inventoryItem.purchasePrice]);
            }
        }
    }
}
exports.MarketListingRepository = MarketListingRepository;
