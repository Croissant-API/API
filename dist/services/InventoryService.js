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
const uuid_1 = require("uuid");
let InventoryService = class InventoryService {
    constructor(databaseService, userService) {
        this.databaseService = databaseService;
        this.userService = userService;
    }
    async getCorrectedUserId(userId) {
        const user = await this.userService.getUser(userId);
        return user?.user_id || userId;
    }
    parseMetadata(metadataJson) {
        if (!metadataJson)
            return undefined;
        try {
            return JSON.parse(metadataJson);
        }
        catch {
            return undefined;
        }
    }
    async getInventory(userId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read("SELECT user_id, item_id, amount, metadata FROM inventories WHERE user_id = ? AND amount > 0", [correctedUserId]);
        const processedItems = items.map((item) => ({
            user_id: item.user_id,
            item_id: item.item_id,
            amount: item.amount,
            metadata: this.parseMetadata(item.metadata ?? null)
        }));
        return { user_id: userId, inventory: processedItems };
    }
    async getItemAmount(userId, itemId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read("SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ?", [correctedUserId, itemId]);
        return items.length === 0 || !items[0].amount ? 0 : items[0].amount;
    }
    async addItem(userId, itemId, amount, metadata) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        if (metadata) {
            // Items avec métadonnées : créer des entrées uniques pour chaque quantité
            const metadataWithUniqueId = { ...metadata, _unique_id: (0, uuid_1.v4)() };
            for (let i = 0; i < amount; i++) {
                const uniqueMetadata = { ...metadataWithUniqueId, _unique_id: (0, uuid_1.v4)() };
                await this.databaseService.update("INSERT INTO inventories (user_id, item_id, amount, metadata) VALUES (?, ?, ?, ?)", [correctedUserId, itemId, 1, JSON.stringify(uniqueMetadata)]);
            }
        }
        else {
            // Items sans métadonnées : peuvent s'empiler
            const items = await this.databaseService.read("SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL", [correctedUserId, itemId]);
            if (items.length > 0) {
                await this.databaseService.update("UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL", [amount, correctedUserId, itemId]);
            }
            else {
                await this.databaseService.update("INSERT INTO inventories (user_id, item_id, amount, metadata) VALUES (?, ?, ?, ?)", [correctedUserId, itemId, amount, null]);
            }
        }
    }
    async setItemAmount(userId, itemId, amount) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        if (amount <= 0) {
            await this.databaseService.update(`DELETE FROM inventories WHERE user_id = ? AND item_id = ?`, [correctedUserId, itemId]);
            return;
        }
        // Items sans métadonnées seulement
        const items = await this.databaseService.read("SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL", [correctedUserId, itemId]);
        if (items.length > 0) {
            await this.databaseService.update(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL`, [amount, correctedUserId, itemId]);
        }
        else {
            await this.databaseService.update(`INSERT INTO inventories (user_id, item_id, amount, metadata) VALUES (?, ?, ?, ?)`, [correctedUserId, itemId, amount, null]);
        }
    }
    async updateItemMetadata(userId, itemId, uniqueId, metadata) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const metadataWithUniqueId = { ...metadata, _unique_id: uniqueId };
        const metadataJson = JSON.stringify(metadataWithUniqueId);
        await this.databaseService.update("UPDATE inventories SET metadata = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?", [metadataJson, correctedUserId, itemId, uniqueId]);
    }
    async removeItem(userId, itemId, amount) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        // Ne supprimer que les items SANS métadonnées
        const items = await this.databaseService.read(`SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL ORDER BY amount DESC`, [correctedUserId, itemId]);
        let remainingToRemove = amount;
        for (const item of items) {
            if (remainingToRemove <= 0)
                break;
            // Items sans métadonnées : peuvent être réduits
            const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await this.databaseService.update(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL`, [correctedUserId, itemId]);
            }
            else {
                await this.databaseService.update(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL`, [newAmount, correctedUserId, itemId]);
            }
            remainingToRemove -= toRemoveFromStack;
        }
    }
    async removeItemByUniqueId(userId, itemId, uniqueId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.databaseService.update(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ? LIMIT 1`, [correctedUserId, itemId, uniqueId]);
    }
    async hasItem(userId, itemId, amount = 1) {
        const totalAmount = await this.getItemAmount(userId, itemId);
        return totalAmount >= amount;
    }
    async hasItemWithoutMetadata(userId, itemId, amount = 1) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read("SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL", [correctedUserId, itemId]);
        const totalAmount = items.length === 0 || !items[0].amount ? 0 : items[0].amount;
        return totalAmount >= amount;
    }
};
InventoryService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __param(1, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object, Object])
], InventoryService);
exports.InventoryService = InventoryService;
