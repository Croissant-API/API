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
  private readonly tableName = 'game_gifts';

  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {}

  async createGift(gameId: string, fromUserId: string, message?: string): Promise<GameGift> {
    const knex = this.databaseService.getKnex();
    const giftId = v4();
    const giftCode = this.generateGiftCode();
    const createdAt = new Date().toISOString();

    const giftData = {
      id: giftId,
      gameId,
      fromUserId,
      giftCode,
      createdAt,
      isActive: true,
      message: message || null
    };

    try {
      await knex(this.tableName).insert(giftData);
      
      return {
        id: giftId,
        gameId,
        fromUserId,
        giftCode,
        createdAt: new Date(createdAt),
        isActive: true,
        message
      };
    } catch (err) {
      console.error("Error creating gift", err);
      throw err;
    }
  }

  async claimGift(giftCode: string, userId: string): Promise<GameGift> {
    const knex = this.databaseService.getKnex();
    const gift = await this.getGift(giftCode);
    
    if (!gift) throw new Error("Gift not found");
    if (!gift.isActive) throw new Error("Gift is no longer active");
    if (gift.toUserId) throw new Error("Gift already claimed");
    if (gift.fromUserId === userId) throw new Error("Cannot claim your own gift");

    const claimedAt = new Date().toISOString();
    
    try {
      await knex(this.tableName)
        .where({ giftCode })
        .update({
          toUserId: userId,
          claimedAt,
          isActive: false
        });

      return {
        ...gift,
        toUserId: userId,
        claimedAt: new Date(claimedAt),
        isActive: false
      };
    } catch (err) {
      console.error("Error claiming gift", err);
      throw err;
    }
  }

  async getGift(giftCode: string): Promise<GameGift | null> {
    const knex = this.databaseService.getKnex();
    
    try {
      const row = await knex(this.tableName)
        .where({ giftCode })
        .first();

      if (!row) return null;

      return this.mapRowToGameGift(row);
    } catch (err) {
      console.error("Error getting gift", err);
      throw err;
    }
  }

  async getUserSentGifts(userId: string): Promise<GameGift[]> {
    const knex = this.databaseService.getKnex();
    
    try {
      const rows = await knex(this.tableName)
        .where({ fromUserId: userId })
        .orderBy('createdAt', 'desc');

      return rows.map(row => this.mapRowToGameGift(row));
    } catch (err) {
      console.error("Error getting user sent gifts", err);
      throw err;
    }
  }

  async getUserReceivedGifts(userId: string): Promise<GameGift[]> {
    const knex = this.databaseService.getKnex();
    
    try {
      const rows = await knex(this.tableName)
        .where({ toUserId: userId })
        .orderBy('claimedAt', 'desc');

      return rows.map(row => this.mapRowToGameGift(row));
    } catch (err) {
      console.error("Error getting user received gifts", err);
      throw err;
    }
  }

  async revokeGift(giftId: string, userId: string): Promise<void> {
    const knex = this.databaseService.getKnex();
    
    try {
      const gift = await knex(this.tableName)
        .where({ id: giftId })
        .first();

      if (!gift) throw new Error("Gift not found");
      if (gift.fromUserId !== userId) throw new Error("You can only revoke your own gifts");
      if (!gift.isActive) throw new Error("Gift is no longer active");

      await knex(this.tableName)
        .where({ id: giftId })
        .update({ isActive: false });
    } catch (err) {
      console.error("Error revoking gift", err);
      throw err;
    }
  }

  private generateGiftCode(): string {
    // Génère un code de 16 caractères alphanumériques
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapRowToGameGift(row: any): GameGift {
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
}