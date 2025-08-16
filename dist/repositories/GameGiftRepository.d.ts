import { GameGift } from "../interfaces/GameGift";
import { IDatabaseService } from "../services/DatabaseService";
export declare class GameGiftRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    insertGift(gift: GameGift): Promise<void>;
    updateGiftClaim(giftCode: string, userId: string, claimedAt: Date): Promise<void>;
    updateGiftStatus(giftId: string, isActive: boolean): Promise<void>;
    getGifts(filters?: {
        giftCode?: string;
        giftId?: string;
        fromUserId?: string;
        toUserId?: string;
        isActive?: boolean;
    }, orderBy?: string): Promise<GameGift[]>;
    getGiftByCode(giftCode: string): Promise<GameGift | null>;
    getGiftById(giftId: string): Promise<GameGift | null>;
    getUserSentGifts(userId: string): Promise<GameGift[]>;
    getUserReceivedGifts(userId: string): Promise<GameGift[]>;
    revokeGift(giftId: string): Promise<void>;
}
