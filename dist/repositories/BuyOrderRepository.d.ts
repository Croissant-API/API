import { BuyOrder } from "../interfaces/BuyOrder";
import { IDatabaseService } from "../services/DatabaseService";
export declare class BuyOrderRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    insertBuyOrder(order: BuyOrder): Promise<void>;
    updateBuyOrderStatusToCancelled(orderId: string, buyerId: string, updatedAt: string): Promise<void>;
    getBuyOrdersByUser(userId: string): Promise<BuyOrder[]>;
    getActiveBuyOrdersForItem(itemId: string): Promise<BuyOrder[]>;
    matchSellOrder(itemId: string, sellPrice: number): Promise<BuyOrder | null>;
}
