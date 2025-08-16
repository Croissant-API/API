import { v4 as uuidv4 } from "uuid";
import { inject, injectable } from "inversify";
import { BuyOrder } from "../interfaces/BuyOrder";
import { IDatabaseService } from "./DatabaseService";
import { BuyOrderRepository } from "../repositories/BuyOrderRepository";

export interface IBuyOrderService {
    createBuyOrder(buyerId: string, itemId: string, price: number): Promise<BuyOrder>;
    cancelBuyOrder(orderId: string, buyerId: string): Promise<void>;
    getBuyOrders(filters?: { userId?: string; itemId?: string; status?: string; minPrice?: number }, orderBy?: string, limit?: number): Promise<BuyOrder[]>;
    matchSellOrder(itemId: string, price: number): Promise<BuyOrder | null>;
}

@injectable()
export class BuyOrderService implements IBuyOrderService {
    private buyOrderRepository: BuyOrderRepository;
    constructor(
        @inject("DatabaseService") private databaseService: IDatabaseService
    ) {
        this.buyOrderRepository = new BuyOrderRepository(this.databaseService);
    }

    async createBuyOrder(buyerId: string, itemId: string, price: number): Promise<BuyOrder> {
        const now = new Date().toISOString();
        const order: BuyOrder = {
            id: uuidv4(),
            buyer_id: buyerId,
            item_id: itemId,
            price,
            status: "active",
            created_at: now,
            updated_at: now
        };
        await this.buyOrderRepository.insertBuyOrder(order);
        return order;
    }

    async cancelBuyOrder(orderId: string, buyerId: string): Promise<void> {
        await this.buyOrderRepository.updateBuyOrderStatusToCancelled(orderId, buyerId, new Date().toISOString());
    }

    async getBuyOrders(
        filters: { userId?: string; itemId?: string; status?: string; minPrice?: number } = {},
        orderBy: string = "created_at DESC",
        limit?: number
    ): Promise<BuyOrder[]> {
        return await this.buyOrderRepository.getBuyOrders(filters, orderBy, limit);
    }

    async matchSellOrder(itemId: string, sellPrice: number): Promise<BuyOrder | null> {
        const orders = await this.buyOrderRepository.getBuyOrders(
            { itemId, status: "active", minPrice: sellPrice },
            "price DESC, created_at ASC",
            1
        );
        return orders.length > 0 ? orders[0] : null;
    }
}