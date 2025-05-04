import { IDatabaseService } from "./DatabaseService";
import { Trade, TradeItem } from "../interfaces/Trade";
import { IInventoryService } from "./InventoryService";
export interface ITradeService {
    createTrade(trade: Omit<Trade, "id">): Promise<Omit<Trade, "id">>;
    getTradeById(id: string): Promise<Trade | null>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    updateTradeStatus(id: string, status: string): Promise<void>;
    approveTrade(id: string, userId: string): Promise<void>;
    deleteTrade(id: string): Promise<void>;
    addItemToTrade(tradeId: string, userKey: "fromUserItems" | "toUserItems", tradeItem: TradeItem): Promise<void>;
    removeItemToTrade(tradeId: string, userKey: "fromUserItems" | "toUserItems", tradeItem: TradeItem): Promise<void>;
}
export declare class TradeService implements ITradeService {
    private databaseService;
    private inventoryService;
    constructor(databaseService: IDatabaseService, inventoryService: IInventoryService);
    createTrade(trade: Omit<Trade, "id">): Promise<Omit<Trade, "id">>;
    getTradeById(id: string): Promise<Trade | null>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    updateTradeStatus(id: string, status: string): Promise<void>;
    approveTrade(id: string, userId: string): Promise<void>;
    deleteTrade(id: string): Promise<void>;
    addItemToTrade(tradeId: string, userKey: "fromUserItems" | "toUserItems", tradeItem: TradeItem): Promise<void>;
    removeItemToTrade(tradeId: string, userKey: "fromUserItems" | "toUserItems", tradePredicate: TradeItem): Promise<void>;
    exchangeTradeItems(tradeId: string, fromUserId: string, toUserId: string): Promise<void>;
    private deserializeTrade;
}
