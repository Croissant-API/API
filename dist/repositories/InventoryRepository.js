"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryRepository = void 0;
class InventoryRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async deleteNonExistingItems(userId) {
        const db = await this.databaseService.getDb();
        const existingItemIds = await db.collection('items').find({ deleted: { $in: [null, false] } }).project({ itemId: 1 }).toArray();
        const existingItemIdsSet = new Set(existingItemIds.map(item => item.itemId));
        await db.collection('inventories').deleteMany({
            user_id: userId,
            item_id: { $nin: Array.from(existingItemIdsSet) }
        });
    }
    async getInventory(filters = {}) {
        const db = await this.databaseService.getDb();
        const matchStage = {};
        if (filters.userId) {
            matchStage.user_id = filters.userId;
        }
        if (filters.itemId) {
            matchStage.item_id = filters.itemId;
        }
        if (filters.sellable !== undefined) {
            matchStage.sellable = filters.sellable;
        }
        if (filters.minAmount !== undefined) {
            matchStage.amount = { $gte: filters.minAmount };
        }
        if (filters.purchasePrice !== undefined) {
            matchStage.$or = [
                { purchasePrice: filters.purchasePrice },
                { purchasePrice: null }
            ];
        }
        if (filters.uniqueId) {
            matchStage['metadata._unique_id'] = filters.uniqueId;
        }
        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'items',
                    let: { itemId: '$item_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$itemId', '$$itemId'] },
                                deleted: { $in: [null, false] }
                            }
                        }
                    ],
                    as: 'itemData'
                }
            },
            { $unwind: '$itemData' },
            {
                $project: {
                    user_id: 1,
                    item_id: 1,
                    amount: 1,
                    metadata: 1,
                    sellable: 1,
                    purchasePrice: 1,
                    rarity: 1,
                    custom_url_link: 1,
                    itemId: '$itemData.itemId',
                    name: '$itemData.name',
                    description: '$itemData.description',
                    iconHash: '$itemData.iconHash',
                    price: '$itemData.price',
                    owner: '$itemData.owner',
                    showInStore: '$itemData.showInStore'
                }
            }
        ];
        const items = await db.collection('inventories').aggregate(pipeline).toArray();
        return items;
    }
    async getInventoryItems(userId) {
        return this.getInventory({ userId, minAmount: 1 });
    }
    async getItemAmount(userId, itemId) {
        const items = await this.getInventory({ userId, itemId });
        return items.reduce((sum, item) => sum + (item.amount || 0), 0);
    }
    async hasItemWithoutMetadata(userId, itemId, amount) {
        const items = await this.getInventory({ userId, itemId });
        const totalAmount = items.filter(i => !i.metadata).reduce((sum, i) => sum + (i.amount || 0), 0);
        return totalAmount >= amount;
    }
    async hasItemWithoutMetadataSellable(userId, itemId, amount) {
        const items = await this.getInventory({ userId, itemId, sellable: true });
        const totalAmount = items.filter(i => !i.metadata).reduce((sum, i) => sum + (i.amount || 0), 0);
        return totalAmount >= amount;
    }
    async addItem(userId, itemId, amount, metadata, sellable, purchasePrice, uuidv4) {
        const db = await this.databaseService.getDb();
        if (metadata) {
            // Insert individual items with unique metadata
            const documents = [];
            for (let i = 0; i < amount; i++) {
                const uniqueMetadata = { ...metadata, _unique_id: uuidv4() };
                documents.push({
                    user_id: userId,
                    item_id: itemId,
                    amount: 1,
                    metadata: uniqueMetadata,
                    sellable,
                    purchasePrice,
                    rarity: metadata['rarity'],
                    custom_url_link: metadata['custom_url_link']
                });
            }
            await db.collection('inventories').insertMany(documents);
        }
        else {
            // Try to update existing stack
            const existingFilter = {
                user_id: userId,
                item_id: itemId,
                metadata: null,
                sellable,
                purchasePrice: purchasePrice === undefined ? null : purchasePrice
            };
            const result = await db.collection('inventories').updateOne(existingFilter, { $inc: { amount } });
            if (result.matchedCount === 0) {
                // Insert new stack if it doesn't exist
                await db.collection('inventories').insertOne({
                    user_id: userId,
                    item_id: itemId,
                    amount,
                    metadata: null,
                    sellable,
                    purchasePrice
                });
            }
        }
    }
    async setItemAmount(userId, itemId, amount) {
        const db = await this.databaseService.getDb();
        if (amount <= 0) {
            await db.collection('inventories').deleteMany({ user_id: userId, item_id: itemId });
            return;
        }
        const result = await db.collection('inventories').updateOne({ user_id: userId, item_id: itemId, metadata: null }, { $set: { amount } });
        if (result.matchedCount === 0) {
            await db.collection('inventories').insertOne({
                user_id: userId,
                item_id: itemId,
                amount,
                metadata: null,
                sellable: false,
                purchasePrice: null
            });
        }
    }
    async updateItemMetadata(userId, itemId, uniqueId, metadata) {
        const db = await this.databaseService.getDb();
        const metadataWithUniqueId = { ...metadata, _unique_id: uniqueId };
        await db.collection('inventories').updateOne({ user_id: userId, item_id: itemId, 'metadata._unique_id': uniqueId }, { $set: { metadata: metadataWithUniqueId } });
    }
    async removeItem(userId, itemId, amount, dataItemIndex) {
        const db = await this.databaseService.getDb();
        const items = await this.getInventory({ userId, itemId });
        if (typeof dataItemIndex === 'number' && items[dataItemIndex]) {
            const item = items[dataItemIndex];
            const toRemoveFromStack = Math.min(amount, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await db.collection('inventories').deleteOne({
                    user_id: userId,
                    item_id: item.item_id,
                    sellable: item.sellable,
                    amount: item.amount,
                    purchasePrice: item.purchasePrice
                });
            }
            else {
                await db.collection('inventories').updateOne({
                    user_id: userId,
                    item_id: item.item_id,
                    metadata: null,
                    sellable: item.sellable,
                    amount: item.amount,
                    purchasePrice: item.purchasePrice
                }, { $set: { amount: newAmount } });
            }
            return;
        }
        let remainingToRemove = amount;
        for (const item of items) {
            if (remainingToRemove <= 0)
                break;
            const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await db.collection('inventories').deleteOne({
                    user_id: userId,
                    item_id: itemId,
                    metadata: null,
                    sellable: item.sellable,
                    amount: item.amount
                });
            }
            else {
                await db.collection('inventories').updateOne({
                    user_id: userId,
                    item_id: itemId,
                    metadata: null,
                    sellable: item.sellable,
                    amount: item.amount
                }, { $set: { amount: newAmount } });
            }
            remainingToRemove -= toRemoveFromStack;
        }
    }
    async removeItemByUniqueId(userId, itemId, uniqueId) {
        const db = await this.databaseService.getDb();
        await db.collection('inventories').deleteOne({
            user_id: userId,
            item_id: itemId,
            'metadata._unique_id': uniqueId
        });
    }
    async removeSellableItem(userId, itemId, amount) {
        const db = await this.databaseService.getDb();
        const items = await this.getInventory({ userId, itemId, sellable: true });
        let remainingToRemove = amount;
        for (const item of items) {
            if (remainingToRemove <= 0)
                break;
            const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await db.collection('inventories').deleteOne({
                    user_id: userId,
                    item_id: itemId,
                    metadata: null,
                    sellable: true
                });
            }
            else {
                await db.collection('inventories').updateOne({
                    user_id: userId,
                    item_id: itemId,
                    metadata: null,
                    sellable: true
                }, { $set: { amount: newAmount } });
            }
            remainingToRemove -= toRemoveFromStack;
        }
    }
    async removeSellableItemWithPrice(userId, itemId, amount, purchasePrice, dataItemIndex) {
        const db = await this.databaseService.getDb();
        const items = await this.getInventory({ userId, itemId, sellable: true, purchasePrice });
        if (typeof dataItemIndex === 'number' && items[dataItemIndex]) {
            const item = items[dataItemIndex];
            const toRemoveFromStack = Math.min(amount, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await db.collection('inventories').deleteOne({
                    user_id: userId,
                    item_id: itemId,
                    metadata: null,
                    sellable: true,
                    amount: item.amount,
                    purchasePrice
                });
            }
            else {
                await db.collection('inventories').updateOne({
                    user_id: userId,
                    item_id: itemId,
                    metadata: null,
                    sellable: true,
                    amount: item.amount,
                    purchasePrice
                }, { $set: { amount: newAmount } });
            }
            return;
        }
        let remainingToRemove = amount;
        for (const item of items) {
            if (remainingToRemove <= 0)
                break;
            const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await db.collection('inventories').deleteOne({
                    user_id: userId,
                    item_id: itemId,
                    metadata: null,
                    sellable: true,
                    amount: item.amount,
                    purchasePrice
                });
            }
            else {
                await db.collection('inventories').updateOne({
                    user_id: userId,
                    item_id: itemId,
                    metadata: null,
                    sellable: true,
                    amount: item.amount,
                    purchasePrice
                }, { $set: { amount: newAmount } });
            }
            remainingToRemove -= toRemoveFromStack;
        }
    }
    async transferItem(fromUserId, toUserId, itemId, uniqueId) {
        const db = await this.databaseService.getDb();
        await db.collection('inventories').updateOne({
            user_id: fromUserId,
            item_id: itemId,
            'metadata._unique_id': uniqueId
        }, { $set: { user_id: toUserId } });
    }
}
exports.InventoryRepository = InventoryRepository;
