import { inject, injectable } from "inversify";
import { IDatabaseConnection, IDatabaseService } from "./DatabaseService";
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
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      // Vérifier que l'utilisateur possède le jeu
      const userGames = await connection.read<{id: string}>(
        `SELECT id FROM user_games WHERE user_id = ? AND game_id = ?`,
        [fromUserId, gameId]
      );

      if (userGames.length === 0) {
        throw new Error("Vous ne possédez pas ce jeu");
      }

      const giftId = v4();
      const giftCode = this.generateGiftCode();
      const createdAt = new Date();

      await connection.request(
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
    });
  }

  async claimGift(giftCode: string, userId: string): Promise<GameGift> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      // Récupérer le cadeau avec verrouillage
      const giftRows = await connection.read<GameGift>(
        `SELECT * FROM game_gifts WHERE giftCode = ? FOR UPDATE`,
        [giftCode]
      );

      if (giftRows.length === 0) {
        throw new Error("Gift not found");
      }

      const gift = giftRows[0];
      
      if (!gift.isActive) {
        throw new Error("Gift is no longer active");
      }
      
      if (gift.toUserId) {
        throw new Error("Gift already claimed");
      }
      
      if (gift.fromUserId === userId) {
        throw new Error("Cannot claim your own gift");
      }

      // Vérifier que l'utilisateur ne possède pas déjà le jeu
      const existingGame = await connection.read<{id: string}>(
        `SELECT id FROM user_games WHERE user_id = ? AND game_id = ?`,
        [userId, gift.gameId]
      );

      if (existingGame.length > 0) {
        throw new Error("You already own this game");
      }

      const claimedAt = new Date();

      // Mettre à jour le cadeau
      await connection.request(
        `UPDATE game_gifts SET toUserId = ?, claimedAt = ?, isActive = 0 WHERE giftCode = ?`,
        [userId, claimedAt.toISOString(), giftCode]
      );

      // Ajouter le jeu à la bibliothèque de l'utilisateur
      await connection.request(
        `INSERT INTO user_games (id, user_id, game_id, acquired_at) VALUES (?, ?, ?, ?)`,
        [v4(), userId, gift.gameId, claimedAt.toISOString()]
      );

      return {
        id: gift.id,
        gameId: gift.gameId,
        fromUserId: gift.fromUserId,
        toUserId: userId,
        giftCode: gift.giftCode,
        createdAt: new Date(gift.createdAt),
        claimedAt,
        isActive: false,
        message: gift.message
      };
    });
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
    await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      // Récupérer le cadeau avec verrouillage
      const giftRows = await connection.read<GameGift>(
        `SELECT * FROM game_gifts WHERE id = ? FOR UPDATE`,
        [giftId]
      );

      if (giftRows.length === 0) {
        throw new Error("Gift not found");
      }

      const gift = giftRows[0];
      
      if (gift.fromUserId !== userId) {
        throw new Error("You can only revoke your own gifts");
      }
      
      if (!gift.isActive) {
        throw new Error("Gift is no longer active");
      }

      if (gift.toUserId) {
        throw new Error("Cannot revoke a gift that has already been claimed");
      }

      // Révoquer le cadeau
      await connection.request(
        `UPDATE game_gifts SET isActive = 0, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), giftId]
      );
    });
  }

  private generateGiftCode(): string {
    // Génère un code de 16 caractères alphanumériques
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }
}