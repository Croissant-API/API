"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGiftRepository = void 0;
class GameGiftRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async insertGift(gift) {
        await this.databaseService.request(`INSERT INTO game_gifts (id, gameId, fromUserId, giftCode, createdAt, isActive, message)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [gift.id, gift.gameId, gift.fromUserId, gift.giftCode, gift.createdAt.toISOString(), 1, gift.message || null]);
    }
    async updateGiftClaim(giftCode, userId, claimedAt) {
        await this.databaseService.request(`UPDATE game_gifts SET toUserId = ?, claimedAt = ?, isActive = 0 WHERE giftCode = ?`, [userId, claimedAt.toISOString(), giftCode]);
    }
    async getGiftByCode(giftCode) {
        const rows = await this.databaseService.read(`SELECT * FROM game_gifts WHERE giftCode = ?`, [giftCode]);
        if (rows.length === 0)
            return null;
        const row = rows[0];
        return {
            id: row.id,
            gameId: row.gameId,
            fromUserId: row.fromUserId,
            toUserId: row.toUserId,
            giftCode: row.giftCode,
            createdAt: new Date(row.createdAt),
            claimedAt: row.claimedAt ? new Date(row.claimedAt) : undefined,
            isActive: Boolean(row.isActive),
            message: row.message
        };
    }
    async getUserSentGifts(userId) {
        const rows = await this.databaseService.read(`SELECT * FROM game_gifts WHERE fromUserId = ? ORDER BY createdAt DESC`, [userId]);
        return rows.map((row) => ({
            id: row.id,
            gameId: row.gameId,
            fromUserId: row.fromUserId,
            toUserId: row.toUserId,
            giftCode: row.giftCode,
            createdAt: new Date(row.createdAt),
            claimedAt: row.claimedAt ? new Date(row.claimedAt) : undefined,
            isActive: Boolean(row.isActive),
            message: row.message
        }));
    }
    async getUserReceivedGifts(userId) {
        const rows = await this.databaseService.read(`SELECT * FROM game_gifts WHERE toUserId = ? ORDER BY claimedAt DESC`, [userId]);
        return rows.map((row) => ({
            id: row.id,
            gameId: row.gameId,
            fromUserId: row.fromUserId,
            toUserId: row.toUserId,
            giftCode: row.giftCode,
            createdAt: new Date(row.createdAt),
            claimedAt: row.claimedAt ? new Date(row.claimedAt) : undefined,
            isActive: Boolean(row.isActive),
            message: row.message
        }));
    }
    async getGiftById(giftId) {
        const rows = await this.databaseService.read(`SELECT * FROM game_gifts WHERE id = ?`, [giftId]);
        if (rows.length === 0)
            return null;
        const row = rows[0];
        return {
            id: row.id,
            gameId: row.gameId,
            fromUserId: row.fromUserId,
            toUserId: row.toUserId,
            giftCode: row.giftCode,
            createdAt: new Date(row.createdAt),
            claimedAt: row.claimedAt ? new Date(row.claimedAt) : undefined,
            isActive: Boolean(row.isActive),
            message: row.message
        };
    }
    async revokeGift(giftId) {
        await this.databaseService.request(`UPDATE game_gifts SET isActive = 0 WHERE id = ?`, [giftId]);
    }
}
exports.GameGiftRepository = GameGiftRepository;
