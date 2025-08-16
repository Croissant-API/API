import { GameGift } from "../interfaces/GameGift";
import { IDatabaseService } from "../services/DatabaseService";

export class GameGiftRepository {
    constructor(private databaseService: IDatabaseService) { }

    async insertGift(gift: GameGift): Promise<void> {
        await this.databaseService.request(
            `INSERT INTO game_gifts (id, gameId, fromUserId, giftCode, createdAt, isActive, message)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [gift.id, gift.gameId, gift.fromUserId, gift.giftCode, gift.createdAt.toISOString(), 1, gift.message || null]
        );
    }

    async updateGiftClaim(giftCode: string, userId: string, claimedAt: Date): Promise<void> {
        await this.databaseService.request(
            `UPDATE game_gifts SET toUserId = ?, claimedAt = ?, isActive = 0 WHERE giftCode = ?`,
            [userId, claimedAt.toISOString(), giftCode]
        );
    }

    async getGiftByCode(giftCode: string): Promise<GameGift | null> {
        const rows = await this.databaseService.read<GameGift>(
            `SELECT * FROM game_gifts WHERE giftCode = ?`,
            [giftCode]
        );
        if (rows.length === 0) return null;
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

    async getUserSentGifts(userId: string): Promise<GameGift[]> {
        const rows = await this.databaseService.read<GameGift>(
            `SELECT * FROM game_gifts WHERE fromUserId = ? ORDER BY createdAt DESC`,
            [userId]
        );
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

    async getUserReceivedGifts(userId: string): Promise<GameGift[]> {
        const rows = await this.databaseService.read<GameGift>(
            `SELECT * FROM game_gifts WHERE toUserId = ? ORDER BY claimedAt DESC`,
            [userId]
        );
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

    async getGiftById(giftId: string): Promise<GameGift | null> {
        const rows = await this.databaseService.read<GameGift>(
            `SELECT * FROM game_gifts WHERE id = ?`,
            [giftId]
        );
        if (rows.length === 0) return null;
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

    async revokeGift(giftId: string): Promise<void> {
        await this.databaseService.request(
            `UPDATE game_gifts SET isActive = 0 WHERE id = ?`,
            [giftId]
        );
    }
}
