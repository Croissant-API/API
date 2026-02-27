export class BuyOrderRepository {
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
    async getBuyOrders(filters = {}, orderBy = 'created_at DESC', limit) {
        let query = `SELECT * FROM buy_orders WHERE 1=1`;
        const params = [];
        if (filters.userId) {
            query += ` AND buyer_id = ?`;
            params.push(filters.userId);
        }
        if (filters.itemId) {
            query += ` AND item_id = ?`;
            params.push(filters.itemId);
        }
        if (filters.status) {
            query += ` AND status = ?`;
            params.push(filters.status);
        }
        if (filters.minPrice !== undefined) {
            query += ` AND price >= ?`;
            params.push(filters.minPrice);
        }
        query += ` ORDER BY ${orderBy}`;
        if (limit) {
            query += ` LIMIT ${limit}`;
        }
        return await this.databaseService.read(query, params);
    }
}
