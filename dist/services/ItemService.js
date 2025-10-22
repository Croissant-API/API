"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemService = void 0;
const inversify_1 = require("inversify");
const ItemRepository_1 = require("../repositories/ItemRepository");
let ItemService = class ItemService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.itemRepository = new ItemRepository_1.ItemRepository(this.databaseService);
    }
    async createItem(item) {
        await this.itemRepository.createItem(item);
    }
    async getItem(itemId) {
        return this.itemRepository.getItem(itemId);
    }
    async getAllItems() {
        return this.itemRepository.getAllItems();
    }
    async getStoreItems() {
        return this.itemRepository.getStoreItems();
    }
    async getMyItems(userId) {
        return this.itemRepository.getMyItems(userId);
    }
    async updateItem(itemId, item) {
        await this.itemRepository.updateItem(itemId, item, buildUpdateFields);
    }
    async deleteItem(itemId) {
        await this.itemRepository.deleteItem(itemId);
    }
    async searchItemsByName(query) {
        return this.itemRepository.searchItemsByName(query);
    }
    async transferOwnership(itemId, newOwnerId) {
        const item = await this.getItem(itemId);
        if (!item)
            throw new Error('Item not found');
        if (item.deleted)
            throw new Error('Cannot transfer deleted item');
        await this.updateItem(itemId, { owner: newOwnerId });
    }
};
exports.ItemService = ItemService;
exports.ItemService = ItemService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)('DatabaseService'))
], ItemService);
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
        values.push(['showInStore', 'deleted'].includes(key) ? toDbBool(obj[key]) : obj[key]);
    }
    return { fields, values };
}
