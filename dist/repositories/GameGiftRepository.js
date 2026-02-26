"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGiftRepository = void 0;
class GameGiftRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async insertGift(gift) {
        // await this.databaseService.request(
        //   `INSERT INTO game_gifts (id, gameId, fromUserId, giftCode, createdAt, isActive, message)
        //          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        //   [gift.id, gift.gameId, gift.fromUserId, gift.giftCode, gift.createdAt.toISOString(), 1, gift.message || null]
        // );
        // MongoDB query to insert a game gift
        const db = await this.databaseService.getDb();
        await db.collection('game_gifts').insertOne({
            id: gift.id,
            gameId: gift.gameId,
            fromUserId: gift.fromUserId,
            toUserId: gift.toUserId || null,
            giftCode: gift.giftCode,
            createdAt: new Date(gift.createdAt),
            claimedAt: gift.claimedAt ? new Date(gift.claimedAt) : null,
            isActive: gift.isActive,
            message: gift.message || null
        });
    }
    async updateGiftClaim(giftCode, userId, claimedAt) {
        // await this.databaseService.request(`UPDATE game_gifts SET toUserId = ?, claimedAt = ?, isActive = 0 WHERE giftCode = ?`, [userId, claimedAt.toISOString(), giftCode]);
        const db = await this.databaseService.getDb();
        await db.collection('game_gifts').updateOne({ giftCode: giftCode }, { $set: { toUserId: userId, claimedAt: new Date(claimedAt), isActive: false } });
    }
    async updateGiftStatus(giftId, isActive) {
        // await this.databaseService.request(`UPDATE game_gifts SET isActive = ? WHERE id = ?`, [isActive ? 1 : 0, giftId]);
        const db = await this.databaseService.getDb();
        await db.collection('game_gifts').updateOne({ id: giftId }, { $set: { isActive: isActive } });
    }
    // Méthode générique pour récupérer les gifts selon des filtres
    async getGifts(filters = {}, orderBy = 'createdAt DESC') {
        // let query = `SELECT * FROM game_gifts WHERE 1=1`;
        // const params = [];
        // if (filters.giftCode) {
        //   query += ` AND giftCode = ?`;
        //   params.push(filters.giftCode);
        // }
        // if (filters.giftId) {
        //   query += ` AND id = ?`;
        //   params.push(filters.giftId);
        // }
        // if (filters.fromUserId) {
        //   query += ` AND fromUserId = ?`;
        //   params.push(filters.fromUserId);
        // }
        // if (filters.toUserId) {
        //   query += ` AND toUserId = ?`;
        //   params.push(filters.toUserId);
        // }
        // if (filters.isActive !== undefined) {
        //   query += ` AND isActive = ?`;
        //   params.push(filters.isActive ? 1 : 0);
        // }
        // query += ` ORDER BY ${orderBy}`;
        // const rows = await this.databaseService.read<GameGift>(query, params);
        // return rows.map(row => ({
        //   id: row.id,
        //   gameId: row.gameId,
        //   fromUserId: row.fromUserId,
        //   toUserId: row.toUserId,
        //   giftCode: row.giftCode,
        //   createdAt: new Date(row.createdAt),
        //   claimedAt: row.claimedAt ? new Date(row.claimedAt) : undefined,
        //   isActive: Boolean(row.isActive),
        //   message: row.message,
        // }));
        // MongoDB query to get gifts with filters
        const db = await this.databaseService.getDb();
        const mongoQuery = {};
        if (filters.giftCode) {
            mongoQuery.giftCode = filters.giftCode;
        }
        if (filters.giftId) {
            mongoQuery.id = filters.giftId;
        }
        if (filters.fromUserId) {
            mongoQuery.fromUserId = filters.fromUserId;
        }
        if (filters.toUserId) {
            mongoQuery.toUserId = filters.toUserId;
        }
        if (filters.isActive !== undefined) {
            mongoQuery.isActive = filters.isActive;
        }
        const result = await db.collection('game_gifts').find(mongoQuery).toArray();
        // Convert MongoDB documents to GameGift interface if necessary
        const gifts = result.map(doc => ({
            id: doc.id,
            gameId: doc.gameId,
            fromUserId: doc.fromUserId,
            toUserId: doc.toUserId,
            giftCode: doc.giftCode,
            createdAt: doc.createdAt.toISOString(),
            claimedAt: doc.claimedAt ? doc.claimedAt.toISOString() : null,
            isActive: Boolean(doc.isActive),
            message: doc.message || null
        }));
        return gifts;
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
        return await this.getGifts({ fromUserId: userId }, 'createdAt DESC');
    }
    async getUserReceivedGifts(userId) {
        return await this.getGifts({ toUserId: userId }, 'claimedAt DESC');
    }
    async revokeGift(giftId) {
        await this.updateGiftStatus(giftId, false);
    }
}
exports.GameGiftRepository = GameGiftRepository;
