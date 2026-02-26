import { BuyOrder } from '../interfaces/BuyOrder';
import { IDatabaseService } from '../services/DatabaseService';

export class BuyOrderRepository {
  constructor(private databaseService: IDatabaseService) {}

  async insertBuyOrder(order: BuyOrder): Promise<void> {
    // await this.databaseService.request(
    //   `INSERT INTO buy_orders (id, buyer_id, item_id, price, status, created_at, updated_at)
    //          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    //   [order.id, order.buyer_id, order.item_id, order.price, order.status, order.created_at, order.updated_at]
    // );

    // MongoDB query to insert a buy order
    const db = await this.databaseService.getDb();
    await db.collection('buy_orders').insertOne({
      id: order.id,
      buyer_id: order.buyer_id,
      item_id: order.item_id,
      price: order.price,
      status: order.status,
      created_at: new Date(order.created_at),
      updated_at: new Date(order.updated_at),
      fulfilled_at: order.fulfilled_at ? new Date(order.fulfilled_at) : null
    });
  }

  async updateBuyOrderStatusToCancelled(orderId: string, buyerId: string, updatedAt: string): Promise<void> {
    // await this.databaseService.request(
    //   `UPDATE buy_orders 
    //          SET status = 'cancelled', updated_at = ? 
    //          WHERE id = ? AND buyer_id = ? AND status = 'active'`,
    //   [updatedAt, orderId, buyerId]
    // );
    // MongoDB query to update buy order status to cancelled
    const db = await this.databaseService.getDb();
    await db.collection('buy_orders').updateOne(
      { id: orderId, buyer_id: buyerId, status: 'active' },
      { $set: { status: 'cancelled', updated_at: new Date(updatedAt) } }
    );
  }

  async getBuyOrders(filters: { userId?: string; itemId?: string; status?: string; minPrice?: number } = {}, orderBy: string = 'created_at DESC', limit?: number): Promise<BuyOrder[]> {
    // let query = `SELECT * FROM buy_orders WHERE 1=1`;
    // const params = [];

    // if (filters.userId) {
    //   query += ` AND buyer_id = ?`;
    //   params.push(filters.userId);
    // }
    // if (filters.itemId) {
    //   query += ` AND item_id = ?`;
    //   params.push(filters.itemId);
    // }
    // if (filters.status) {
    //   query += ` AND status = ?`;
    //   params.push(filters.status);
    // }
    // if (filters.minPrice !== undefined) {
    //   query += ` AND price >= ?`;
    //   params.push(filters.minPrice);
    // }

    // query += ` ORDER BY ${orderBy}`;
    // if (limit) {
    //   query += ` LIMIT ${limit}`;
    // }

    // return await this.databaseService.read<BuyOrder>(query, params);
    // MongoDB query to get buy orders with filters
    const db = await this.databaseService.getDb();
    const mongoQuery: any = {};
    if (filters.userId) {
      mongoQuery.buyer_id = filters.userId;
    }
    if (filters.itemId) {
      mongoQuery.item_id = filters.itemId;
    }
    if (filters.status) {
      mongoQuery.status = filters.status;
    }
    if (filters.minPrice !== undefined) {
      mongoQuery.price = { $gte: filters.minPrice };
    }

    const result = await db.collection('buy_orders').find(mongoQuery).toArray();

    // Convert MongoDB documents to BuyOrder interface if necessary
    const buyOrders: BuyOrder[] = result.map(doc => ({
      id: doc.id,
      buyer_id: doc.buyer_id,
      item_id: doc.item_id,
      price: doc.price,
      status: doc.status,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString(),
      fulfilled_at: doc.fulfilled_at ? doc.fulfilled_at.toISOString() : null
    }));
    return buyOrders;
  }
}
