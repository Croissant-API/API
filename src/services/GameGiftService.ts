import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { GameGiftRepository } from "../repositories/GameGiftRepository";
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
  private gameGiftRepository: GameGiftRepository;
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {
    this.gameGiftRepository = new GameGiftRepository(this.databaseService);
  }

  async createGift(gameId: string, fromUserId: string, message?: string): Promise<GameGift> {
    const giftId = v4();
    const giftCode = this.generateGiftCode();
    const createdAt = new Date();
    const gift: GameGift = {
      id: giftId,
      gameId,
      fromUserId,
      giftCode,
      createdAt,
      isActive: true,
      message
    };
    await this.gameGiftRepository.insertGift(gift);
    return gift;
  }

  async claimGift(giftCode: string, userId: string): Promise<GameGift> {
    const gift = await this.getGift(giftCode);
    if (!gift) throw new Error("Gift not found");
    if (!gift.isActive) throw new Error("Gift is no longer active");
    if (gift.toUserId) throw new Error("Gift already claimed");
    if (gift.fromUserId === userId) throw new Error("Cannot claim your own gift");
    const claimedAt = new Date();
    await this.gameGiftRepository.updateGiftClaim(giftCode, userId, claimedAt);
    return {
      ...gift,
      toUserId: userId,
      claimedAt,
      isActive: false
    };
  }

  async getGift(giftCode: string): Promise<GameGift | null> {
    return await this.gameGiftRepository.getGiftByCode(giftCode);
  }

  async getUserSentGifts(userId: string): Promise<GameGift[]> {
    return await this.gameGiftRepository.getUserSentGifts(userId);
  }

  async getUserReceivedGifts(userId: string): Promise<GameGift[]> {
    return await this.gameGiftRepository.getUserReceivedGifts(userId);
  }


  async revokeGift(giftId: string, userId: string): Promise<void> {
    const gift = await this.gameGiftRepository.getGiftById(giftId);
    if (!gift) throw new Error("Gift not found");
    if (gift.fromUserId !== userId) throw new Error("You can only revoke your own gifts");
    if (!gift.isActive) throw new Error("Gift is no longer active");
    await this.gameGiftRepository.revokeGift(giftId);
  }

  private generateGiftCode(): string {
    // Génère un code de 16 caractères alphanumériques
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }
}