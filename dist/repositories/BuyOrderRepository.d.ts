import { BuyOrder } from "../interfaces/BuyOrder";
import { IDatabaseService } from "../services/DatabaseService";
export declare class BuyOrderRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    insertBuyOrder(order: BuyOrder): Promise<void>;
    updateBuyOrderStatusToCancelled(orderId: string, buyerId: string, updatedAt: string): Promise<void>;
    getBuyOrders(filters?: {
        userId?: string;
        itemId?: string;
        status?: string;
        minPrice?: number;
    }, orderBy?: string, limit?: number): Promise<BuyOrder[]>;
}

