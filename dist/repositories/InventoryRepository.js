"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryRepository = void 0;
class InventoryRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async deleteNonExistingItems(userId) {
        await this.databaseService.request(`DELETE FROM inventories 
       WHERE user_id = ? 
       AND item_id NOT IN (
         SELECT itemId FROM items WHERE deleted IS NULL OR deleted = 0
       )`, [userId]);
    }
    async getInventoryItems(userId) {
        const items = await this.databaseService.read(`SELECT 
         inv.user_id, 
         inv.item_id, 
         inv.amount, 
         inv.metadata,
         inv.sellable,
         inv.purchasePrice,
         inv.rarity,
         inv.custom_url_link,
         i.itemId,
         i.name,
         i.description,
         i.iconHash,
         i.price,
         i.owner,
         i.showInStore
       FROM inventories inv
       INNER JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
       WHERE inv.user_id = ? AND inv.amount > 0`, [userId]);
        return items.sort((a, b) => {
            const nameCompare = a.name?.localeCompare(b.name || '') || 0;
            if (nameCompare !== 0)
                return nameCompare;
            if (!a.metadata && b.metadata)
                return -1;
            if (a.metadata && !b.metadata)
                return 1;
            return 0;
        }).map((item) => ({
            user_id: item.user_id,
            item_id: item.item_id,
            amount: item.amount,
            metadata: item.metadata,
            sellable: !!item.sellable,
            purchasePrice: item.purchasePrice,
            name: item.name,
            description: item.description,
            iconHash: item.iconHash,
            price: item.purchasePrice,
            rarity: item.rarity,
            custom_url_link: item.custom_url_link
        }));
    }
    async getItemAmount(userId, itemId) {
        const items = await this.databaseService.read("SELECT SUM(amount) as amount FROM inventories WHERE user_id = ? AND item_id = ?", [userId, itemId]);
        return items.length === 0 || !items[0].amount ? 0 : items[0].amount;
    }
    async addItem(userId, itemId, amount, metadata, sellable, purchasePrice, uuidv4) {
        if (metadata) {
            const metadataWithUniqueId = { ...metadata, _unique_id: uuidv4() };
            for (let i = 0; i < amount; i++) {
                const uniqueMetadata = { ...metadataWithUniqueId, _unique_id: uuidv4() };
                await this.databaseService.request("INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice, rarity, custom_url_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [userId, itemId, 1, JSON.stringify(uniqueMetadata), sellable ? 1 : 0, purchasePrice, metadata["rarity"], metadata["custom_url_link"]]);
            }
        }
        else {
            const items = await this.databaseService.read("SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND (purchasePrice = ? OR (purchasePrice IS NULL AND ? IS NULL))", [userId, itemId, sellable ? 1 : 0, purchasePrice, purchasePrice]);
            if (items.length > 0) {
                await this.databaseService.request("UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND (purchasePrice = ? OR (purchasePrice IS NULL AND ? IS NULL))", [amount, userId, itemId, sellable ? 1 : 0, purchasePrice, purchasePrice]);
            }
            else {
                await this.databaseService.request("INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)", [userId, itemId, amount, null, sellable ? 1 : 0, purchasePrice]);
            }
        }
    }
    async setItemAmount(userId, itemId, amount) {
        if (amount <= 0) {
            await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ?`, [userId, itemId]);
            return;
        }
        const items = await this.databaseService.read("SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL", [userId, itemId]);
        if (items.length > 0) {
            await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL`, [amount, userId, itemId]);
        }
        else {
            await this.databaseService.request(`INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)`, [userId, itemId, amount, null, 0, null]);
        }
    }
    async updateItemMetadata(userId, itemId, uniqueId, metadata) {
        const metadataWithUniqueId = { ...metadata, _unique_id: uniqueId };
        const metadataJson = JSON.stringify(metadataWithUniqueId);
        await this.databaseService.request("UPDATE inventories SET metadata = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?", [metadataJson, userId, itemId, uniqueId]);
    }
    async removeItem(userId, itemId, amount, dataItemIndex) {
        // On récupère tous les stacks correspondants, triés par amount DESC pour vider les plus gros d'abord
        const items = await this.getInventoryItems(userId);
        // Si dataItemIndex est défini, on ne retire que sur ce stack précis
        if (typeof dataItemIndex === "number" && items[dataItemIndex]) {
            const item = items[dataItemIndex];
            const toRemoveFromStack = Math.min(amount, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND sellable = ? AND amount = ?  AND purchasePrice = ? LIMIT 1`, [userId, item.item_id, item.sellable ? 1 : 0, item.amount, item.purchasePrice]);
            }
            else {
                await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND amount = ? AND purchasePrice = ? LIMIT 1`, [newAmount, userId, item.item_id, item.sellable ? 1 : 0, item.amount, item.purchasePrice]);
            }
            return;
        }
        // Sinon, comportement classique (réparti sur tous les stacks)
        let remainingToRemove = amount;
        for (const item of items) {
            if (remainingToRemove <= 0)
                break;
            const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND amount = ? LIMIT 1`, [userId, itemId, item.sellable ? 1 : 0, item.amount]);
            }
            else {
                await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND amount = ? LIMIT 1`, [newAmount, userId, itemId, item.sellable ? 1 : 0, item.amount]);
            }
            remainingToRemove -= toRemoveFromStack;
        }
    }
    async removeItemByUniqueId(userId, itemId, uniqueId) {
        await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`, [userId, itemId, uniqueId]);
    }
    async hasItemWithoutMetadata(userId, itemId, amount) {
        const items = await this.databaseService.read("SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL", [userId, itemId]);
        const totalAmount = items.length === 0 || !items[0].total ? 0 : items[0].total;
        return totalAmount >= amount;
    }
    async hasItemWithoutMetadataSellable(userId, itemId, amount) {
        const items = await this.databaseService.read("SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1", [userId, itemId]);
        const totalAmount = items.length === 0 || !items[0].total ? 0 : items[0].total;
        return totalAmount >= amount;
    }
    async removeSellableItem(userId, itemId, amount) {
        const items = await this.databaseService.read(`SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 ORDER BY amount DESC`, [userId, itemId]);
        let remainingToRemove = amount;
        for (const item of items) {
            if (remainingToRemove <= 0)
                break;
            const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1`, [userId, itemId]);
            }
            else {
                await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1`, [newAmount, userId, itemId]);
            }
            remainingToRemove -= toRemoveFromStack;
        }
    }
    async removeSellableItemWithPrice(userId, itemId, amount, purchasePrice, dataItemIndex) {
        const items = await this.databaseService.read(`SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND purchasePrice = ? ORDER BY amount DESC`, [userId, itemId, purchasePrice]);
        // Si dataItemIndex est défini, on ne retire que sur ce stack précis
        if (typeof dataItemIndex === "number" && items[dataItemIndex]) {
            const item = items[dataItemIndex];
            const toRemoveFromStack = Math.min(amount, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND amount = ? AND purchasePrice = ? LIMIT 1`, [userId, itemId, item.amount, purchasePrice]);
            }
            else {
                await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND amount = ? AND purchasePrice = ? LIMIT 1`, [newAmount, userId, itemId, item.amount, purchasePrice]);
            }
            return;
        }
        // Sinon, comportement classique (réparti sur tous les stacks)
        let remainingToRemove = amount;
        for (const item of items) {
            if (remainingToRemove <= 0)
                break;
            const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND amount = ? AND purchasePrice = ? LIMIT 1`, [userId, itemId, item.amount, purchasePrice]);
            }
            else {
                await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND amount = ? AND purchasePrice = ? LIMIT 1`, [newAmount, userId, itemId, item.amount, purchasePrice]);
            }
            remainingToRemove -= toRemoveFromStack;
        }
    }
    async transferItem(fromUserId, toUserId, itemId, uniqueId) {
        const items = await this.databaseService.read(`SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`, [fromUserId, itemId, uniqueId]);
        if (items.length === 0) {
            throw new Error("Item not found in user's inventory");
        }
        await this.databaseService.request(`UPDATE inventories SET user_id = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`, [toUserId, fromUserId, itemId, uniqueId]);
    }
}
exports.InventoryRepository = InventoryRepository;
