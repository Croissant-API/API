import { Trade } from "../interfaces/Trade";
import { IDatabaseService } from "../services/DatabaseService";
export declare class TradeRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    findPendingTrade(fromUserId: string, toUserId: string): Promise<Trade | null>;
    createTrade(trade: Trade): Promise<void>;
    getTradeById(id: string): Promise<Trade | null>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    updateTradeField(tradeId: string, field: string, value: unknown, updatedAt: string): Promise<void>;
    updateTradeFields(tradeId: string, fields: Record<string, unknown>): Promise<void>;
}
