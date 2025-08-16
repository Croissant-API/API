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
    async updateGiftStatus(giftId, isActive) {
        await this.databaseService.request(`UPDATE game_gifts SET isActive = ? WHERE id = ?`, [isActive ? 1 : 0, giftId]);
    }
    // Méthode générique pour récupérer les gifts selon des filtres
    async getGifts(filters = {}, orderBy = "createdAt DESC") {
        let query = `SELECT * FROM game_gifts WHERE 1=1`;
        const params = [];
        if (filters.giftCode) {
            query += ` AND giftCode = ?`;
            params.push(filters.giftCode);
        }
        if (filters.giftId) {
            query += ` AND id = ?`;
            params.push(filters.giftId);
        }
        if (filters.fromUserId) {
            query += ` AND fromUserId = ?`;
            params.push(filters.fromUserId);
        }
        if (filters.toUserId) {
            query += ` AND toUserId = ?`;
            params.push(filters.toUserId);
        }
        if (filters.isActive !== undefined) {
            query += ` AND isActive = ?`;
            params.push(filters.isActive ? 1 : 0);
        }
        query += ` ORDER BY ${orderBy}`;
        const rows = await this.databaseService.read(query, params);
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
    // Surcharges utilisant la méthode générique
    async getGiftByCode(giftCode) {
        const gifts = await this.getGifts({ giftCode });
        return gifts[0] || null;
    }
    async getGiftById(giftId) {
        const gifts = await this.getGifts({ giftId });
        return gifts[0] || null;
    }
    async getUserSentGifts(userId) {
        return await this.getGifts({ fromUserId: userId }, "createdAt DESC");
    }
    async getUserReceivedGifts(userId) {
        return await this.getGifts({ toUserId: userId }, "claimedAt DESC");
    }
    async revokeGift(giftId) {
        await this.updateGiftStatus(giftId, false);
    }
}
exports.GameGiftRepository = GameGiftRepository;
