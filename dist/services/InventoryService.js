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
exports.InventoryService = void 0;
const inversify_1 = require("inversify");
let InventoryService = class InventoryService {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getInventory(userId) {
        const items = await this.databaseService.read("SELECT user_id, item_id, amount FROM inventories WHERE user_id = ?", [userId]);
        const filteredItems = items
            .filter(item => item.amount > 0); // Filter out items with amount <= 0
        return { user_id: userId, inventory: filteredItems };
    }
    async getItemAmount(userId, itemId) {
        const items = await this.databaseService.read("SELECT amount FROM inventories WHERE user_id = ? AND item_id = ?", [userId, itemId]);
        if (items.length === 0)
            return 0;
        return items[0].amount;
    }
    async addItem(userId, itemId, amount) {
        // Try to update, if not exists, insert
        await this.databaseService.update(`INSERT INTO inventories (user_id, item_id, amount)
             VALUES (?, ?, ?)`, 
        //  ON CONFLICT(user_id, item_id) DO UPDATE SET amount = amount + ?`,
        [userId, itemId, amount]);
    }
    async removeItem(userId, itemId, amount) {
        // Decrease amount, but not below zero
        await this.databaseService.update(`UPDATE inventories SET amount = MAX(amount - ?, 0)
             WHERE user_id = ? AND item_id = ?`, [amount, userId, itemId]);
    }
    async setItemAmount(userId, itemId, amount) {
        await this.databaseService.update(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ?`, [amount, userId, itemId]);
    }
    async hasItem(userId, itemId, amount = 1) {
        const items = await this.getInventory(userId);
        const item = items.inventory.find(item => item.item_id === itemId);
        if (!item)
            return false;
        return item.amount >= amount;
    }
};
InventoryService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], InventoryService);
exports.InventoryService = InventoryService;
