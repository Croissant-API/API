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
    constructor(databaseService, userService) {
        this.databaseService = databaseService;
        this.userService = userService;
    }
    async getCorrectedUserId(userId) {
        const user = await this.userService.getUser(userId);
        return user?.user_id || userId;
    }
    async getInventory(userId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read("SELECT user_id, item_id, amount FROM inventories WHERE user_id = ? AND amount > 0", [correctedUserId]);
        return { user_id: userId, inventory: items };
    }
    async getFormattedInventory(userId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read(`SELECT DISTINCT
         i.itemId,
         i.name,
         i.description,
         inv.amount,
         i.iconHash
       FROM inventories inv
       INNER JOIN items i ON inv.item_id = i.itemId
       WHERE inv.user_id = ? 
         AND inv.amount > 0 
         AND (i.deleted IS NULL OR i.deleted = 0)
       ORDER BY i.name`, [correctedUserId]);
        return items;
    }
    async getItemAmount(userId, itemId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read("SELECT amount FROM inventories WHERE user_id = ? AND item_id = ?", [correctedUserId, itemId]);
        return items.length === 0 ? 0 : items[0].amount;
    }
    async addItem(userId, itemId, amount) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read("SELECT * FROM inventories WHERE user_id = ? AND item_id = ?", [correctedUserId, itemId]);
        if (items.length > 0) {
            await this.databaseService.update("UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ?", [amount, correctedUserId, itemId]);
        }
        else {
            await this.databaseService.update("INSERT INTO inventories (user_id, item_id, amount) VALUES (?, ?, ?)", [correctedUserId, itemId, amount]);
        }
    }
    async removeItem(userId, itemId, amount) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.databaseService.update(`UPDATE inventories SET amount = MAX(amount - ?, 0) WHERE user_id = ? AND item_id = ?`, [amount, correctedUserId, itemId]);
    }
    async setItemAmount(userId, itemId, amount) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.databaseService.update(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ?`, [amount, correctedUserId, itemId]);
    }
    async hasItem(userId, itemId, amount = 1) {
        const items = await this.getInventory(userId);
        const item = items.inventory.find((item) => item.item_id === itemId);
        if (!item)
            return false;
        return item.amount >= amount;
    }
};
InventoryService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __param(1, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object, Object])
], InventoryService);
exports.InventoryService = InventoryService;
