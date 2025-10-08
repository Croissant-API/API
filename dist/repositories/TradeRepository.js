"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeRepository = void 0;
class TradeRepository {
    constructor(db) {
        this.db = db;
    }
    async findPendingTrade(fromUserId, toUserId) {
        const trades = await this.db.read(`SELECT * FROM trades
       WHERE status = 'pending'
         AND ((fromUserId = ? AND toUserId = ?) OR (fromUserId = ? AND toUserId = ?))
       ORDER BY createdAt DESC
       LIMIT 1`, [fromUserId, toUserId, toUserId, fromUserId]);
        return trades[0] ?? null;
    }
    async createTrade(trade) {
        await this.db.request(`INSERT INTO trades (id, fromUserId, toUserId, fromUserItems, toUserItems, approvedFromUser, approvedToUser, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [trade.id, trade.fromUserId, trade.toUserId, JSON.stringify(trade.fromUserItems), JSON.stringify(trade.toUserItems), 0, 0, trade.status, trade.createdAt, trade.updatedAt]);
    }
    async getTradeById(id) {
        const trades = await this.db.read("SELECT * FROM trades WHERE id = ?", [id]);
        return trades[0] ?? null;
    }
    async getTradesByUser(userId) {
        return this.db.read("SELECT * FROM trades WHERE fromUserId = ? OR toUserId = ? ORDER BY createdAt DESC", [userId, userId]);
    }
    async updateTradeField(tradeId, field, value, updatedAt) {
        await this.db.request(`UPDATE trades SET ${field} = ?, updatedAt = ? WHERE id = ?`, [value, updatedAt, tradeId]);
    }
    async updateTradeFields(tradeId, fields) {
        const setClause = Object.keys(fields).map(f => `${f} = ?`).join(", ");
        const values = [...Object.values(fields), tradeId];
        await this.db.request(`UPDATE trades SET ${setClause} WHERE id = ?`, values);
    }
}
exports.TradeRepository = TradeRepository;

