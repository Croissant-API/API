import { IDatabaseService } from "./DatabaseService";
import { GameGift } from "../interfaces/GameGift";
export interface IGameGiftService {
    createGift(gameId: string, fromUserId: string, message?: string): Promise<GameGift>;
    claimGift(giftCode: string, userId: string): Promise<GameGift>;
    getGift(giftCode: string): Promise<GameGift | null>;
    getUserSentGifts(userId: string): Promise<GameGift[]>;
    getUserReceivedGifts(userId: string): Promise<GameGift[]>;
    revokeGift(giftId: string, userId: string): Promise<void>;
}
export declare class GameGiftService implements IGameGiftService {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    createGift(gameId: string, fromUserId: string, message?: string): Promise<GameGift>;
    claimGift(giftCode: string, userId: string): Promise<GameGift>;
    getGift(giftCode: string): Promise<GameGift | null>;
    getUserSentGifts(userId: string): Promise<GameGift[]>;
    getUserReceivedGifts(userId: string): Promise<GameGift[]>;
    revokeGift(giftId: string, userId: string): Promise<void>;
    private generateGiftCode;
}
