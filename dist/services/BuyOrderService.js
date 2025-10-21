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
exports.BuyOrderService = void 0;
const inversify_1 = require("inversify");
const uuid_1 = require("uuid");
const BuyOrderRepository_1 = require("../repositories/BuyOrderRepository");
let BuyOrderService = class BuyOrderService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.buyOrderRepository = new BuyOrderRepository_1.BuyOrderRepository(this.databaseService);
    }
    async createBuyOrder(buyerId, itemId, price) {
        const now = new Date().toISOString();
        const order = {
            id: (0, uuid_1.v4)(),
            buyer_id: buyerId,
            item_id: itemId,
            price,
            status: 'active',
            created_at: now,
            updated_at: now,
        };
        await this.buyOrderRepository.insertBuyOrder(order);
        return order;
    }
    async cancelBuyOrder(orderId, buyerId) {
        await this.buyOrderRepository.updateBuyOrderStatusToCancelled(orderId, buyerId, new Date().toISOString());
    }
    async getBuyOrders(filters = {}, orderBy = 'created_at DESC', limit) {
        return await this.buyOrderRepository.getBuyOrders(filters, orderBy, limit);
    }
    async matchSellOrder(itemId, sellPrice) {
        const orders = await this.buyOrderRepository.getBuyOrders({ itemId, status: 'active', minPrice: sellPrice }, 'price DESC, created_at ASC', 1);
        return orders.length > 0 ? orders[0] : null;
    }
};
exports.BuyOrderService = BuyOrderService;
exports.BuyOrderService = BuyOrderService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)('DatabaseService')),
    __metadata("design:paramtypes", [Object])
], BuyOrderService);
