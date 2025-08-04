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
const uuid_1 = require("uuid");
const inversify_1 = require("inversify");
let BuyOrderService = class BuyOrderService {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async createBuyOrder(buyerId, itemId, price) {
        const now = new Date().toISOString();
        const order = {
            id: (0, uuid_1.v4)(),
            buyer_id: buyerId,
            item_id: itemId,
            price,
            status: "active",
            created_at: now,
            updated_at: now
        };
        await this.databaseService.create(`INSERT INTO buy_orders (id, buyer_id, item_id, price, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [order.id, order.buyer_id, order.item_id, order.price, order.status, order.created_at, order.updated_at]);
        return order;
    }
    async cancelBuyOrder(orderId, buyerId) {
        await this.databaseService.update(`UPDATE buy_orders 
             SET status = 'cancelled', updated_at = ? 
             WHERE id = ? AND buyer_id = ? AND status = 'active'`, [new Date().toISOString(), orderId, buyerId]);
    }
    async getBuyOrdersByUser(userId) {
        return await this.databaseService.read(`SELECT * FROM buy_orders 
             WHERE buyer_id = ? 
             ORDER BY created_at DESC`, [userId]);
    }
    async getActiveBuyOrdersForItem(itemId) {
        return await this.databaseService.read(`SELECT * FROM buy_orders 
             WHERE item_id = ? AND status = 'active' 
             ORDER BY price DESC, created_at ASC`, [itemId]);
    }
    async matchSellOrder(itemId, sellPrice) {
        const orders = await this.databaseService.read(`SELECT * FROM buy_orders 
             WHERE item_id = ? AND status = 'active' AND price >= ? 
             ORDER BY price DESC, created_at ASC 
             LIMIT 1`, [itemId, sellPrice]);
        return orders.length > 0 ? orders[0] : null;
    }
};
exports.BuyOrderService = BuyOrderService;
exports.BuyOrderService = BuyOrderService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], BuyOrderService);
