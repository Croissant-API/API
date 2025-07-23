"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemService = void 0;
const inversify_1 = require("inversify");
let ItemService = class ItemService {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async createItem(item) {
        // Check if itemId already exists (even if deleted)
        const existingItems = await this.databaseService.read("SELECT * FROM items WHERE itemId = ?", [item.itemId]);
        if (existingItems.length > 0) {
            throw new Error("ItemId already exists");
        }
        await this.databaseService.create(`INSERT INTO items (itemId, name, description, price, owner, iconHash, showInStore, deleted)
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
    async updateItem(itemId, item) {
        const { fields, values } = buildUpdateFields(item);
        if (!fields.length)
            return;
        values.push(itemId);
        await this.databaseService.update(`UPDATE items SET ${fields.join(", ")} WHERE itemId = ?`, values);
    }
    async deleteItem(itemId) {
        await this.databaseService.delete("UPDATE items SET deleted = 1 WHERE itemId = ?", [itemId]);
    }
    /**
     * Search items by name, only those with showInStore = true and not deleted
     */
    async searchItemsByName(query) {
        return this.databaseService.read("SELECT * FROM items WHERE name LIKE ? AND showInStore = 1 AND deleted = 0", [`%${query}%`]);
    }
    async transferOwnership(itemId, newOwnerId) {
        const item = await this.getItem(itemId);
        if (!item)
            throw new Error("Item not found");
        if (item.deleted)
            throw new Error("Cannot transfer deleted item");
        await this.updateItem(itemId, { owner: newOwnerId });
    }
};
ItemService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], ItemService);
exports.ItemService = ItemService;
function toDbBool(val) {
    return val ? 1 : 0;
}
function buildUpdateFields(obj, skip = []) {
    const fields = [];
    const values = [];
    for (const key in obj) {
        if (skip.includes(key))
            continue;
        fields.push(`${key} = ?`);
        values.push(["showInStore", "deleted"].includes(key) ? toDbBool(obj[key]) : obj[key]);
    }
    return { fields, values };
}
