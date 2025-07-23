import { IDatabaseService } from "./DatabaseService";
import { Trade, TradeItem } from "../interfaces/Trade";
import { IInventoryService } from "./InventoryService";
import { IItemService } from "./ItemService";
export interface ITradeService {
    startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
    getTradeById(id: string): Promise<Trade | null>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    addItemToTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    removeItemFromTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    approveTrade(tradeId: string, userId: string): Promise<void>;
    cancelTrade(tradeId: string, userId: string): Promise<void>;
}
export declare class TradeService implements ITradeService {
    private databaseService;
    private inventoryService;
    private itemService;
    constructor(databaseService: IDatabaseService, inventoryService: IInventoryService, itemService: IItemService);
    startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
    private enrichTradeItems;
    getTradeById(id: string): Promise<Trade | null>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    private getUserKey;
    private assertPending;
    addItemToTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    removeItemFromTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    approveTrade(tradeId: string, userId: string): Promise<void>;
    cancelTrade(tradeId: string, userId: string): Promise<void>;
    private exchangeTradeItems;
    private deserializeTrade;
}
