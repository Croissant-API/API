import { IDatabaseService } from "./DatabaseService";
import { Trade, TradeItem } from "../interfaces/Trade";
import { IInventoryService } from "./InventoryService";
export interface ITradeService {
    startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
    getTradeById(id: string): Promise<Trade | null>;
    getFormattedTradeById(id: string): Promise<Trade | null>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    getFormattedTradesByUser(userId: string): Promise<Trade[]>;
    addItemToTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    removeItemFromTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    approveTrade(tradeId: string, userId: string): Promise<void>;
    cancelTrade(tradeId: string, userId: string): Promise<void>;
}
export declare class TradeService implements ITradeService {
    private databaseService;
    private inventoryService;
    private tradeRepository;
    constructor(databaseService: IDatabaseService, inventoryService: IInventoryService);
    startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
    getTradeById(id: string): Promise<Trade | null>;
    getFormattedTradeById(id: string): Promise<Trade | null>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    getFormattedTradesByUser(userId: string): Promise<Trade[]>;
    private getUserKey;
    private assertPending;
    private parseTradeItems;
    addItemToTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    removeItemFromTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    approveTrade(tradeId: string, userId: string): Promise<void>;
    cancelTrade(tradeId: string, userId: string): Promise<void>;
    private exchangeTradeItems;
}
