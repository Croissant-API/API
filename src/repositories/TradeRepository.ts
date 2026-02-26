import { Trade } from '../interfaces/Trade';
import { IDatabaseService } from '../services/DatabaseService';

export class TradeRepository {
  constructor(private db: IDatabaseService) { }

  async findPendingTrade(fromUserId: string, toUserId: string): Promise<Trade | null> {
    const db = await this.db.getDb();
    const result = await db.collection('trades')
      .find({
        status: 'pending',
        $or: [
          { fromUserId, toUserId },
          { fromUserId: toUserId, toUserId: fromUserId }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();

    const trade = result as Trade | null;
    return trade || null;
  }

  async createTrade(trade: Trade): Promise<void> {
    const db = await this.db.getDb();
    await db.collection('trades').insertOne({
      ...trade,
      fromUserItems: trade.fromUserItems,
      toUserItems: trade.toUserItems,
      approvedFromUser: 0,
      approvedToUser: 0
    });
  }

  async getTradeById(id: string): Promise<Trade | null> {
    const db = await this.db.getDb();

    const result = await db.collection('trades').findOne({ id });
    return result as Trade | null;
  }

  async getTradesByUser(userId: string): Promise<Trade[]> {
    const db = await this.db.getDb();
    const result = await db.collection('trades')
      .find({ $or: [{ fromUserId: userId }, { toUserId: userId }] })
      .sort({ createdAt: -1 })
      .toArray();
    const trades: Trade[] = result.map(
      doc => ({
        id: doc.id,
        fromUserId: doc.fromUserId,
        toUserId: doc.toUserId,
        fromUserItems: doc.fromUserItems,
        toUserItems: doc.toUserItems,
        approvedFromUser: doc.approvedFromUser,
        approvedToUser: doc.approvedToUser,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }) as Trade
    );
    return trades as Trade[];
  }

  async updateTradeField(tradeId: string, field: string, value: unknown, updatedAt: string): Promise<void> {
    const db = await this.db.getDb();
    await db.collection('trades').updateOne(
      { id: tradeId },
      { $set: { [field]: value, updatedAt } }
    );
  }

  async updateTradeFields(tradeId: string, fields: Record<string, unknown>): Promise<void> {
    const db = await this.db.getDb();
    if (!Object.keys(fields).length) return;
    await db.collection('trades').updateOne({ id: tradeId }, { $set: fields });
  }
}
