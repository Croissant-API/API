"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemRepository = void 0;
class ItemRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async createItem(item) {
        const existing = await this.getItem(item.itemId);
        if (existing)
            throw new Error("ItemId already exists");
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
    
    async getItems(filters = {}, select = "*", orderBy = "name", limit) {
        let query = `SELECT ${select} FROM items WHERE 1=1`;
        const params = [];
        if (filters.itemId) {
            query += " AND itemId = ?";
            params.push(filters.itemId);
        }
        if (filters.owner) {
            query += " AND owner = ?";
            params.push(filters.owner);
        }
        if (filters.showInStore !== undefined) {
            query += " AND showInStore = ?";
            params.push(filters.showInStore ? 1 : 0);
        }
        if (filters.deleted !== undefined) {
            query += " AND deleted = ?";
            params.push(filters.deleted ? 1 : 0);
        }
        if (filters.search) {
            const searchTerm = `%${filters.search.toLowerCase()}%`;
            query += " AND LOWER(name) LIKE ?";
            params.push(searchTerm);
        }
        query += ` ORDER BY ${orderBy}`;
        if (limit)
            query += ` LIMIT ${limit}`;
        return this.databaseService.read(query, params);
    }
    
    async getItem(itemId) {
        const items = await this.getItems({ itemId });
        return items[0] || null;
    }
    async getAllItems() {
        return this.getItems();
    }
    async getStoreItems() {
        return this.getItems({ showInStore: true, deleted: false }, "itemId, name, description, owner, price, iconHash, showInStore");
    }
    async getMyItems(userId) {
        return this.getItems({ owner: userId, deleted: false }, "itemId, name, description, owner, price, iconHash, showInStore");
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
        return this.getItems({ search: query, showInStore: true, deleted: false }, "itemId, name, description, owner, price, iconHash, showInStore", "name", 100);
    }
}
exports.ItemRepository = ItemRepository;

