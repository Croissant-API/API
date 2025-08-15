"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyOrderRepository = void 0;
class BuyOrderRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async insertBuyOrder(order) {
        await this.databaseService.request(`INSERT INTO buy_orders (id, buyer_id, item_id, price, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [order.id, order.buyer_id, order.item_id, order.price, order.status, order.created_at, order.updated_at]);
    }
    async updateBuyOrderStatusToCancelled(orderId, buyerId, updatedAt) {
        await this.databaseService.request(`UPDATE buy_orders 
             SET status = 'cancelled', updated_at = ? 
             WHERE id = ? AND buyer_id = ? AND status = 'active'`, [updatedAt, orderId, buyerId]);
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
}
exports.BuyOrderRepository = BuyOrderRepository;
