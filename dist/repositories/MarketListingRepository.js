"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketListingRepository = void 0;
class MarketListingRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async insertMarketListing(listing) {
        const db = await this.databaseService.getDb();
        await db.collection('market_listings').insertOne({
            ...listing,
            metadata: listing.metadata || {}
        });
    }
    // --- INVENTORY HELPERS ---
    async removeInventoryItemByUniqueId(userId, itemId, uniqueId) {
        const db = await this.databaseService.getDb();
        await db.collection('inventories').deleteOne({
            user_id: userId,
            item_id: itemId,
            'metadata._unique_id': uniqueId
        });
    }
    async updateInventoryAmountOrDelete(userId, itemId, purchasePrice) {
        const db = await this.databaseService.getDb();
        const filter = { user_id: userId, item_id: itemId, purchasePrice };
        const row = await db.collection('inventories').findOne(filter, { projection: { amount: 1 } });
        if (row && row.amount > 1) {
            await db.collection('inventories').updateOne(filter, { $inc: { amount: -1 } });
        }
        else {
            await db.collection('inventories').deleteOne(filter);
        }
    }
    async decrementOrDeleteInventory(userId, itemId) {
        const db = await this.databaseService.getDb();
        await db.collection('inventories').updateMany({ user_id: userId, item_id: itemId, amount: { $gt: 0 } }, { $inc: { amount: -1 } });
        await db.collection('inventories').deleteMany({ user_id: userId, item_id: itemId, amount: 0 });
    }
    // --- MARKET LISTING GENERIC GETTER ---
    async getMarketListings(filters = {}, select = '*', orderBy = 'created_at DESC', limit) {
        const db = await this.databaseService.getDb();
        const query = {};
        if (filters.id)
            query.id = filters.id;
        if (filters.sellerId)
            query.seller_id = filters.sellerId;
        if (filters.itemId)
            query.item_id = filters.itemId;
        if (filters.status)
            query.status = filters.status;
        let cursor = db.collection('market_listings').find(query);
        // sort handling (simple implementation splitting by space)
        if (orderBy) {
            const parts = orderBy.split(',').map(p => p.trim());
            const sort = {};
            parts.forEach(p => {
                const [field, dir] = p.split(' ');
                sort[field] = dir && dir.toUpperCase() === 'DESC' ? -1 : 1;
            });
            cursor = cursor.sort(sort);
        }
        if (limit)
            cursor = cursor.limit(limit);
        const listings = await cursor.toArray();
        const marketListings = listings.map(doc => ({
            id: doc.id,
            seller_id: doc.seller_id,
            item_id: doc.item_id,
            price: doc.price,
            status: doc.status,
            metadata: doc.metadata || {},
            created_at: doc.created_at.toISOString(),
            updated_at: doc.updated_at.toISOString(),
            purchasePrice: doc.purchasePrice || null,
            buyer_id: doc.buyer_id || null,
            sold_at: doc.sold_at ? doc.sold_at.toISOString() : null,
            rarity: doc.rarity || null
        }));
        return marketListings;
    }
    // --- Surcharges utilisant la méthode générique ---
    async getMarketListingById(listingId, sellerId) {
        const filters = { id: listingId, status: 'active' };
        if (sellerId)
            filters.seller_id = sellerId;
        const listings = await this.getMarketListings(filters);
        return listings[0] || null;
    }
    async getMarketListingByIdAnyStatus(listingId) {
        const listings = await this.getMarketListings({ id: listingId });
        return listings[0] || null;
    }
    async getMarketListingsByUser(userId) {
        const db = await this.databaseService.getDb();
        const pipeline = [
            { $match: { seller_id: userId } },
            {
                $lookup: {
                    from: 'items',
                    localField: 'item_id',
                    foreignField: 'itemId',
                    as: 'itemData'
                }
            },
            { $unwind: '$itemData' },
            { $sort: { created_at: -1 } },
            {
                $project: {
                    'id': 1,
                    'seller_id': 1,
                    'item_id': 1,
                    'price': 1,
                    'status': 1,
                    'metadata': 1,
                    'created_at': 1,
                    'updated_at': 1,
                    'purchasePrice': 1,
                    'buyer_id': 1,
                    'sold_at': 1,
                    item_name: '$itemData.name',
                    item_description: '$itemData.description',
                    item_icon_hash: '$itemData.iconHash'
                }
            }
        ];
        return db.collection('market_listings').aggregate(pipeline).toArray();
    }
    async getActiveListingsForItem(itemId) {
        return this.getMarketListings({ itemId, status: 'active' }, '*', 'price ASC, created_at ASC');
    }
    async getEnrichedMarketListings(limit, offset) {
        const db = await this.databaseService.getDb();
        const pipeline = [
            { $match: { status: 'active' } },
            {
                $lookup: {
                    from: 'items',
                    localField: 'item_id',
                    foreignField: 'itemId',
                    as: 'itemData'
                }
            },
            { $unwind: '$itemData' },
            { $match: { 'itemData.deleted': { $in: [null, false] } } },
            { $sort: { created_at: -1 } },
            { $skip: offset },
            { $limit: limit },
            {
                $project: {
                    id: 1,
                    seller_id: 1,
                    item_id: 1,
                    price: 1,
                    status: 1,
                    metadata: 1,
                    created_at: 1,
                    updated_at: 1,
                    purchasePrice: 1,
                    buyer_id: 1,
                    sold_at: 1,
                    item_name: '$itemData.name',
                    item_description: '$itemData.description',
                    item_icon_hash: '$itemData.iconHash'
                }
            }
        ];
        return db.collection('market_listings').aggregate(pipeline).toArray();
    }
    async searchMarketListings(searchTerm, limit) {
        const db = await this.databaseService.getDb();
        const pipeline = [
            { $match: { status: 'active' } },
            {
                $lookup: {
                    from: 'items',
                    localField: 'item_id',
                    foreignField: 'itemId',
                    as: 'itemData'
                }
            },
            { $unwind: '$itemData' },
            { $match: { 'itemData.deleted': { $in: [null, false] }, 'itemData.name': { $regex: searchTerm, $options: 'i' } } },
            { $sort: { price: 1, created_at: 1 } },
            { $limit: limit },
            {
                $project: {
                    id: 1,
                    seller_id: 1,
                    item_id: 1,
                    price: 1,
                    status: 1,
                    metadata: 1,
                    created_at: 1,
                    updated_at: 1,
                    purchasePrice: 1,
                    buyer_id: 1,
                    sold_at: 1,
                    item_name: '$itemData.name',
                    item_description: '$itemData.description',
                    item_icon_hash: '$itemData.iconHash'
                }
            }
        ];
        return db.collection('market_listings').aggregate(pipeline).toArray();
    }
    // --- UPDATE STATUS ---
    async updateMarketListingStatus(listingId, status, updatedAt) {
        const db = await this.databaseService.getDb();
        await db.collection('market_listings').updateOne({ id: listingId }, { $set: { status, updated_at: updatedAt } });
    }
    async updateMarketListingSold(listingId, buyerId, now) {
        const db = await this.databaseService.getDb();
        await db.collection('market_listings').updateOne({ id: listingId }, { $set: { status: 'sold', buyer_id: buyerId, sold_at: now, updated_at: now } });
    }
    async updateBuyOrderToFulfilled(buyOrderId, now) {
        const db = await this.databaseService.getDb();
        await db.collection('buy_orders').updateOne({ id: buyOrderId }, { $set: { status: 'fulfilled', fulfilled_at: now, updated_at: now } });
    }
    // --- INVENTORY ADD ---
    async addItemToInventory(inventoryItem) {
        const db = await this.databaseService.getDb();
        if (inventoryItem.metadata && inventoryItem.metadata._unique_id) {
            await db.collection('inventories').insertOne(inventoryItem);
        }
        else {
            const filter = {
                user_id: inventoryItem.user_id,
                item_id: inventoryItem.item_id,
                purchasePrice: inventoryItem.purchasePrice || null,
                metadata: null
            };
            const existing = await db.collection('inventories').findOne(filter);
            if (existing) {
                await db.collection('inventories').updateOne(filter, { $inc: { amount: inventoryItem.amount } });
            }
            else {
                await db.collection('inventories').insertOne({
                    ...inventoryItem,
                    metadata: null
                });
            }
        }
    }
}
exports.MarketListingRepository = MarketListingRepository;
