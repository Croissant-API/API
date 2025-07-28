import { IDatabaseService } from "./DatabaseService";
import { Trade, TradeItem } from "../interfaces/Trade";
import { IInventoryService } from "./InventoryService";
export interface ITradeService {
    startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
    getTradeById(id: string): Promise<Trade | null>;
    getFormattedTradeById(id: string): Promise<{
        id: string;
        fromUserId: string;
        toUserId: string;
        fromUserItems: Array<{
            itemId: string;
            name: string;
            description: string;
            iconHash?: string;
            amount: number;
            uniqueId?: string;
            metadata?: {
                [key: string]: unknown;
            };
        }>;
        toUserItems: Array<{
            itemId: string;
            name: string;
            description: string;
            iconHash?: string;
            amount: number;
            uniqueId?: string;
            metadata?: {
                [key: string]: unknown;
            };
        }>;
        approvedFromUser: boolean;
        approvedToUser: boolean;
        status: string;
        createdAt: string;
        updatedAt: string;
    } | null>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    getFormattedTradesByUser(userId: string): Promise<Array<{
        id: string;
        fromUserId: string;
        toUserId: string;
        fromUserItems: Array<{
            itemId: string;
            name: string;
            description: string;
            iconHash?: string;
            amount: number;
            uniqueId?: string;
            metadata?: {
                [key: string]: unknown;
            };
        }>;
        toUserItems: Array<{
            itemId: string;
            name: string;
            description: string;
            iconHash?: string;
            amount: number;
            uniqueId?: string;
            metadata?: {
                [key: string]: unknown;
            };
        }>;
        approvedFromUser: boolean;
        approvedToUser: boolean;
        status: string;
        createdAt: string;
        updatedAt: string;
    }>>;
    addItemToTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    removeItemFromTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    approveTrade(tradeId: string, userId: string): Promise<void>;
    cancelTrade(tradeId: string, userId: string): Promise<void>;
}
export declare class TradeService implements ITradeService {
    private databaseService;
    private inventoryService;
    constructor(databaseService: IDatabaseService, inventoryService: IInventoryService);
    startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
    private enrichTradeItemsWithSQL;
    getTradeById(id: string): Promise<Trade | null>;
    getFormattedTradeById(id: string): Promise<{
        id: string;
        fromUserId: string;
        toUserId: string;
        fromUserItems: Array<{
            itemId: string;
            name: string;
            description: string;
            iconHash?: string;
            amount: number;
            uniqueId?: string;
            metadata?: {
                [key: string]: unknown;
            };
        }>;
        toUserItems: Array<{
            itemId: string;
            name: string;
            description: string;
            iconHash?: string;
            amount: number;
            uniqueId?: string;
            metadata?: {
                [key: string]: unknown;
            };
        }>;
        approvedFromUser: boolean;
        approvedToUser: boolean;
        status: string;
        createdAt: string;
        updatedAt: string;
    } | null>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    getFormattedTradesByUser(userId: string): Promise<Array<{
        id: string;
        fromUserId: string;
        toUserId: string;
        fromUserItems: Array<{
            itemId: string;
            name: string;
            description: string;
            iconHash?: string;
            amount: number;
            uniqueId?: string;
            metadata?: {
                [key: string]: unknown;
            };
        }>;
        toUserItems: Array<{
            itemId: string;
            name: string;
            description: string;
            iconHash?: string;
            amount: number;
            uniqueId?: string;
            metadata?: {
                [key: string]: unknown;
            };
        }>;
        approvedFromUser: boolean;
        approvedToUser: boolean;
        status: string;
        createdAt: string;
        updatedAt: string;
    }>>;
    private getUserKey;
    private assertPending;
    addItemToTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    removeItemFromTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    approveTrade(tradeId: string, userId: string): Promise<void>;
    cancelTrade(tradeId: string, userId: string): Promise<void>;
    private exchangeTradeItems;
    private deserializeTrade;
}
