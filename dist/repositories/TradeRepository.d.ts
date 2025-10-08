import { Trade } from "../interfaces/Trade";
import { IDatabaseService } from "../services/DatabaseService";
export declare class TradeRepository {
    private db;
    constructor(db: IDatabaseService);
    findPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
    createTrade(trade: Trade): Promise<void>;
    getTradeById(id: string): Promise<Trade>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    updateTradeField(tradeId: string, field: string, value: unknown, updatedAt: string): Promise<void>;
    updateTradeFields(tradeId: string, fields: Record<string, unknown>): Promise<void>;
}

