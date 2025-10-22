import { BuyOrder } from '../interfaces/BuyOrder';
import { IDatabaseService } from './DatabaseService';
export interface IBuyOrderService {
    createBuyOrder(buyerId: string, itemId: string, price: number): Promise<BuyOrder>;
    cancelBuyOrder(orderId: string, buyerId: string): Promise<void>;
    getBuyOrders(filters?: {
        userId?: string;
        itemId?: string;
        status?: string;
        minPrice?: number;
    }, orderBy?: string, limit?: number): Promise<BuyOrder[]>;
    matchSellOrder(itemId: string, price: number): Promise<BuyOrder | null>;
}
export declare class BuyOrderService implements IBuyOrderService {
    private databaseService;
    private buyOrderRepository;
    constructor(databaseService: IDatabaseService);
    createBuyOrder(buyerId: string, itemId: string, price: number): Promise<BuyOrder>;
    cancelBuyOrder(orderId: string, buyerId: string): Promise<void>;
    getBuyOrders(filters?: {
        userId?: string;
        itemId?: string;
        status?: string;
        minPrice?: number;
    }, orderBy?: string, limit?: number): Promise<BuyOrder[]>;
    matchSellOrder(itemId: string, sellPrice: number): Promise<BuyOrder | null>;
}
