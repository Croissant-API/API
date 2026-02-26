// crypto shim
const crypto = (globalThis.crypto as any) || require('crypto');
import { inject, injectable } from 'inversify';
import { v4 } from 'uuid';
import { GameGift } from '../interfaces/GameGift';
import { GameGiftRepository } from '../repositories/GameGiftRepository';
import { IDatabaseService } from './DatabaseService';

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
  constructor(@inject('DatabaseService') private databaseService: IDatabaseService) {
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
      message,
    };
    await this.gameGiftRepository.insertGift(gift);
    return gift;
  }

  async claimGift(giftCode: string, userId: string): Promise<GameGift> {
    const gift = await this.getGift(giftCode);
    if (!gift) throw new Error('Gift not found');
    if (!gift.isActive) throw new Error('Gift is no longer active');
    if (gift.toUserId) throw new Error('Gift already claimed');
    if (gift.fromUserId === userId) throw new Error('Cannot claim your own gift');
    const claimedAt = new Date();
    await this.gameGiftRepository.updateGiftClaim(giftCode, userId, claimedAt);
    return {
      ...gift,
      toUserId: userId,
      claimedAt,
      isActive: false,
    };
  }

  async getGift(giftCode: string): Promise<GameGift | null> {
    const gifts = await this.gameGiftRepository.getGifts({ giftCode });
    return gifts[0] || null;
  }

  async getUserSentGifts(userId: string): Promise<GameGift[]> {
    return await this.gameGiftRepository.getGifts({ fromUserId: userId }, 'createdAt DESC');
  }

  async getUserReceivedGifts(userId: string): Promise<GameGift[]> {
    return await this.gameGiftRepository.getGifts({ toUserId: userId }, 'claimedAt DESC');
  }

  async revokeGift(giftId: string, userId: string): Promise<void> {
    const gifts = await this.gameGiftRepository.getGifts({ giftId });
    const gift = gifts[0];
    if (!gift) throw new Error('Gift not found');
    if (gift.fromUserId !== userId) throw new Error('You can only revoke your own gifts');
    if (!gift.isActive) throw new Error('Gift is no longer active');
    await this.gameGiftRepository.updateGiftStatus(giftId, false);
  }

  private generateGiftCode(): string {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }
}
