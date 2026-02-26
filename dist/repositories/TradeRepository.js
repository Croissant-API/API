"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeRepository = void 0;
class TradeRepository {
    constructor(db) {
        this.db = db;
    }
    async findPendingTrade(fromUserId, toUserId) {
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
        const trade = result;
        return trade || null;
    }
    async createTrade(trade) {
        const db = await this.db.getDb();
        await db.collection('trades').insertOne({
            ...trade,
            fromUserItems: trade.fromUserItems,
            toUserItems: trade.toUserItems,
            approvedFromUser: 0,
            approvedToUser: 0
        });
    }
    async getTradeById(id) {
        const db = await this.db.getDb();
        const result = await db.collection('trades').findOne({ id });
        return result;
    }
    async getTradesByUser(userId) {
        const db = await this.db.getDb();
        const result = await db.collection('trades')
            .find({ $or: [{ fromUserId: userId }, { toUserId: userId }] })
            .sort({ createdAt: -1 })
            .toArray();
        const trades = result.map(doc => ({
            id: doc.id,
            fromUserId: doc.fromUserId,
            toUserId: doc.toUserId,
            fromUserItems: doc.fromUserItems,
            toUserItems: doc.toUserItems,
            approvedFromUser: doc.approvedFromUser,
            approvedToUser: doc.approvedToUser,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        }));
        return trades;
    }
    async updateTradeField(tradeId, field, value, updatedAt) {
        const db = await this.db.getDb();
        await db.collection('trades').updateOne({ id: tradeId }, { $set: { [field]: value, updatedAt } });
    }
    async updateTradeFields(tradeId, fields) {
        const db = await this.db.getDb();
        if (!Object.keys(fields).length)
            return;
        await db.collection('trades').updateOne({ id: tradeId }, { $set: fields });
    }
}
exports.TradeRepository = TradeRepository;
