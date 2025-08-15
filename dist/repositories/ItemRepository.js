"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemRepository = void 0;
class ItemRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async createItem(item) {
        const existingItems = await this.databaseService.read("SELECT * FROM items WHERE itemId = ?", [item.itemId]);
        if (existingItems.length > 0) {
            throw new Error("ItemId already exists");
        }
        await this.databaseService.request(`INSERT INTO items (itemId, name, description, price, owner, iconHash, showInStore, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            item.itemId,
            item.name ?? null,
            item.description ?? null,
            item.price ?? 0,
            item.owner,
            item.iconHash ?? null,
            item.showInStore ? 1 : 0,
            item.deleted ? 1 : 0,
        ]);
    }
    async getItem(itemId) {
        const items = await this.databaseService.read("SELECT * FROM items WHERE itemId = ?", [itemId]);
        return items[0] || null;
    }
    async getAllItems() {
        return this.databaseService.read("SELECT * FROM items");
    }
    async getStoreItems() {
        return this.databaseService.read(`SELECT itemId, name, description, owner, price, iconHash, showInStore
       FROM items 
       WHERE deleted = 0 AND showInStore = 1
       ORDER BY name`);
    }
    async getMyItems(userId) {
        return this.databaseService.read(`SELECT itemId, name, description, owner, price, iconHash, showInStore
       FROM items 
       WHERE deleted = 0 AND owner = ?
       ORDER BY name`, [userId]);
    }
    async updateItem(itemId, item, buildUpdateFields) {
        const { fields, values } = buildUpdateFields(item);
        if (!fields.length)
            return;
        values.push(itemId);
        await this.databaseService.request(`UPDATE items SET ${fields.join(", ")} WHERE itemId = ?`, values);
    }
    async deleteItem(itemId) {
        await this.databaseService.request("UPDATE items SET deleted = 1 WHERE itemId = ?", [itemId]);
    }
    async searchItemsByName(query) {
        const searchTerm = `%${query.toLowerCase()}%`;
        return this.databaseService.read(`SELECT itemId, name, description, owner, price, iconHash, showInStore
       FROM items 
       WHERE LOWER(name) LIKE ? AND showInStore = 1 AND deleted = 0
       ORDER BY name LIMIT 100`, [searchTerm]);
    }
}
exports.ItemRepository = ItemRepository;
