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
const InventoryRepository_1 = require("../repositories/InventoryRepository");
let InventoryService = class InventoryService {
    constructor(databaseService, userService) {
        this.databaseService = databaseService;
        this.userService = userService;
        this.inventoryRepository = new InventoryRepository_1.InventoryRepository(this.databaseService);
    }
    getInventoryRepository() {
        return this.inventoryRepository;
    }
    async getCorrectedUserId(userId) {
        return (await this.userService.getUser(userId))?.user_id || userId;
    }
    async getInventory(userId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.inventoryRepository.deleteNonExistingItems(correctedUserId);
        const items = await this.inventoryRepository.getInventoryItems(correctedUserId);
        return { user_id: userId, inventory: items };
    }
    async addItem(userId, itemId, amount, metadata, sellable = false, purchasePrice) {
        await this.inventoryRepository.addItem(await this.getCorrectedUserId(userId), itemId, amount, metadata, sellable, purchasePrice, uuid_1.v4);
    }
    async setItemAmount(userId, itemId, amount) {
        await this.inventoryRepository.setItemAmount(await this.getCorrectedUserId(userId), itemId, amount);
    }
    async updateItemMetadata(userId, itemId, uniqueId, metadata) {
        await this.inventoryRepository.updateItemMetadata(await this.getCorrectedUserId(userId), itemId, uniqueId, metadata);
    }
    async removeItem(userId, itemId, amount, dataItemIndex) {
        await this.inventoryRepository.removeItem(await this.getCorrectedUserId(userId), itemId, amount, dataItemIndex);
    }
    async removeItemByUniqueId(userId, itemId, uniqueId) {
        await this.inventoryRepository.removeItemByUniqueId(await this.getCorrectedUserId(userId), itemId, uniqueId);
    }
    async transferItem(fromUserId, toUserId, itemId, uniqueId) {
        await this.inventoryRepository.transferItem(await this.getCorrectedUserId(fromUserId), await this.getCorrectedUserId(toUserId), itemId, uniqueId);
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)('DatabaseService')),
    __param(1, (0, inversify_1.inject)('UserService')),
    __metadata("design:paramtypes", [Object, Object])
], InventoryService);
