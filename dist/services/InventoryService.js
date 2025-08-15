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
const InventoryRepository_1 = require("../repositories/InventoryRepository");
const uuid_1 = require("uuid");
let InventoryService = class InventoryService {
    constructor(databaseService, userService) {
        this.databaseService = databaseService;
        this.userService = userService;
        this.inventoryRepository = new InventoryRepository_1.InventoryRepository(this.databaseService);
    }
    async getCorrectedUserId(userId) {
        const user = await this.userService.getUser(userId);
        return user?.user_id || userId;
    }
    async getInventory(userId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.inventoryRepository.deleteNonExistingItems(correctedUserId);
        const items = await this.inventoryRepository.getInventoryItems(correctedUserId);
        items.sort((a, b) => {
            const nameCompare = a.name?.localeCompare(b.name || '') || 0;
            if (nameCompare !== 0)
                return nameCompare;
            if (!a.metadata && b.metadata)
                return -1;
            if (a.metadata && !b.metadata)
                return 1;
            return 0;
        });
        const processedItems = items.map((item) => ({
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
        return { user_id: userId, inventory: processedItems };
    }
    async getItemAmount(userId, itemId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        return await this.inventoryRepository.getItemAmount(correctedUserId, itemId);
    }
    async addItem(userId, itemId, amount, metadata, sellable = false, purchasePrice) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.inventoryRepository.addItem(correctedUserId, itemId, amount, metadata, sellable, purchasePrice, uuid_1.v4);
    }
    async setItemAmount(userId, itemId, amount) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.inventoryRepository.setItemAmount(correctedUserId, itemId, amount);
    }
    async updateItemMetadata(userId, itemId, uniqueId, metadata) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.inventoryRepository.updateItemMetadata(correctedUserId, itemId, uniqueId, metadata);
    }
    async removeItem(userId, itemId, amount) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.inventoryRepository.removeItem(correctedUserId, itemId, amount);
    }
    async removeItemByUniqueId(userId, itemId, uniqueId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.inventoryRepository.removeItemByUniqueId(correctedUserId, itemId, uniqueId);
    }
    async hasItem(userId, itemId, amount = 1) {
        const totalAmount = await this.getItemAmount(userId, itemId);
        return totalAmount >= amount;
    }
    async hasItemWithoutMetadata(userId, itemId, amount = 1) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        return await this.inventoryRepository.hasItemWithoutMetadata(correctedUserId, itemId, amount);
    }
    // Nouvelle méthode pour vérifier les items sellable
    async hasItemWithoutMetadataSellable(userId, itemId, amount = 1) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        return await this.inventoryRepository.hasItemWithoutMetadataSellable(correctedUserId, itemId, amount);
    }
    // Nouvelle méthode pour supprimer spécifiquement les items sellable
    async removeSellableItem(userId, itemId, amount) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.inventoryRepository.removeSellableItem(correctedUserId, itemId, amount);
    }
    // Nouvelle méthode pour supprimer spécifiquement les items sellable avec un prix donné
    async removeSellableItemWithPrice(userId, itemId, amount, purchasePrice) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.inventoryRepository.removeSellableItemWithPrice(correctedUserId, itemId, amount, purchasePrice);
    }
    async transferItem(fromUserId, toUserId, itemId, uniqueId) {
        const correctedFromUserId = await this.getCorrectedUserId(fromUserId);
        const correctedToUserId = await this.getCorrectedUserId(toUserId);
        await this.inventoryRepository.transferItem(correctedFromUserId, correctedToUserId, itemId, uniqueId);
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __param(1, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object, Object])
], InventoryService);
