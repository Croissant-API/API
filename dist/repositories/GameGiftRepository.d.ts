import { GameGift } from "../interfaces/GameGift";
import { IDatabaseService } from "../services/DatabaseService";
export declare class GameGiftRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    insertGift(gift: GameGift): Promise<void>;
    updateGiftClaim(giftCode: string, userId: string, claimedAt: Date): Promise<void>;
    getGiftByCode(giftCode: string): Promise<GameGift | null>;
    getUserSentGifts(userId: string): Promise<GameGift[]>;
    getUserReceivedGifts(userId: string): Promise<GameGift[]>;
    getGiftById(giftId: string): Promise<GameGift | null>;
    revokeGift(giftId: string): Promise<void>;
}
