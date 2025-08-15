import { v4 as uuidv4 } from "uuid";
import { inject, injectable } from "inversify";
import { BuyOrder } from "../interfaces/BuyOrder";
import { IDatabaseService } from "./DatabaseService";
import { BuyOrderRepository } from "../repositories/BuyOrderRepository";

export interface IBuyOrderService {
    createBuyOrder(buyerId: string, itemId: string, price: number): Promise<BuyOrder>;
    cancelBuyOrder(orderId: string, buyerId: string): Promise<void>;
    getBuyOrdersByUser(userId: string): Promise<BuyOrder[]>;
    getActiveBuyOrdersForItem(itemId: string): Promise<BuyOrder[]>;
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

    async getBuyOrdersByUser(userId: string): Promise<BuyOrder[]> {
        return await this.buyOrderRepository.getBuyOrdersByUser(userId);
    }

    async getActiveBuyOrdersForItem(itemId: string): Promise<BuyOrder[]> {
        return await this.buyOrderRepository.getActiveBuyOrdersForItem(itemId);
    }

    async matchSellOrder(itemId: string, sellPrice: number): Promise<BuyOrder | null> {
        return await this.buyOrderRepository.matchSellOrder(itemId, sellPrice);
    }
}