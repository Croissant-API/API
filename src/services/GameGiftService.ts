import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { GameGift } from "../interfaces/GameGift";
import { v4 } from "uuid";
import crypto from "crypto";

export interface IGameGiftService {
  createGift(gameId: string, fromUserId: string, message?: string): Promise<GameGift>;
  claimGift(giftCode: string, userId: string): Promise<GameGift>;
  getGift(giftCode: string): Promise<GameGift | null>;
  getUserSentGifts(userId: string): Promise<GameGift[]>;
  getUserReceivedGifts(userId: string): Promise<GameGift[]>;
  revokeGift(giftId: string, userId: string): Promise<void>;
}

@injectable()
export class GameGiftService implements IGameGiftService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {}

  async createGift(gameId: string, fromUserId: string, message?: string): Promise<GameGift> {
    const giftId = v4();
    const giftCode = this.generateGiftCode();
    const createdAt = new Date();

    await this.databaseService.request(
      `INSERT INTO game_gifts (id, gameId, fromUserId, giftCode, createdAt, isActive, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [giftId, gameId, fromUserId, giftCode, createdAt.toISOString(), 1, message || null]
    );

    return {
      id: giftId,
      gameId,
      fromUserId,
      giftCode,
      createdAt,
      isActive: true,
      message
    };
  }

  async claimGift(giftCode: string, userId: string): Promise<GameGift> {
    const gift = await this.getGift(giftCode);
    if (!gift) throw new Error("Gift not found");
    if (!gift.isActive) throw new Error("Gift is no longer active");
    if (gift.toUserId) throw new Error("Gift already claimed");
    if (gift.fromUserId === userId) throw new Error("Cannot claim your own gift");

    const claimedAt = new Date();
    await this.databaseService.request(
      `UPDATE game_gifts SET toUserId = ?, claimedAt = ?, isActive = 0 WHERE giftCode = ?`,
      [userId, claimedAt.toISOString(), giftCode]
    );

    return {
      ...gift,
      toUserId: userId,
      claimedAt,
      isActive: false
    };
  }

  async getGift(giftCode: string): Promise<GameGift | null> {
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


  async revokeGift(giftId: string, userId: string): Promise<void> {
    const gift = await this.databaseService.read<GameGift>(
      `SELECT * FROM game_gifts WHERE id = ?`,
      [giftId]
    );

    if (!gift) throw new Error("Gift not found");
    if (gift[0].fromUserId !== userId) throw new Error("You can only revoke your own gifts");
    if (!gift[0].isActive) throw new Error("Gift is no longer active");

    await this.databaseService.request(
      `UPDATE game_gifts SET isActive = 0 WHERE id = ?`,
      [giftId]
    );
  }

  private generateGiftCode(): string {
    // Génère un code de 16 caractères alphanumériques
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }
}