import { BuyOrder } from '../interfaces/BuyOrder';
import { IDatabaseService } from '../services/DatabaseService';

export class BuyOrderRepository {
  constructor(private databaseService: IDatabaseService) {}

  async insertBuyOrder(order: BuyOrder): Promise<void> {
    await this.databaseService.request(
      `INSERT INTO buy_orders (id, buyer_id, item_id, price, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [order.id, order.buyer_id, order.item_id, order.price, order.status, order.created_at, order.updated_at]
    );
  }

  async updateBuyOrderStatusToCancelled(orderId: string, buyerId: string, updatedAt: string): Promise<void> {
    await this.databaseService.request(
      `UPDATE buy_orders 
             SET status = 'cancelled', updated_at = ? 
             WHERE id = ? AND buyer_id = ? AND status = 'active'`,
      [updatedAt, orderId, buyerId]
    );
  }

  async getBuyOrders(filters: { userId?: string; itemId?: string; status?: string; minPrice?: number } = {}, orderBy: string = 'created_at DESC', limit?: number): Promise<BuyOrder[]> {
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

    return await this.databaseService.read<BuyOrder>(query, params);
  }
}
