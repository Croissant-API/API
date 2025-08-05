import { v4 as uuidv4 } from "uuid";
import { inject, injectable } from "inversify";
import { BuyOrder } from "../interfaces/BuyOrder";
import { IDatabaseService } from "./DatabaseService";

export interface IBuyOrderService {
    createBuyOrder(buyerId: string, itemId: string, price: number): Promise<BuyOrder>;
    cancelBuyOrder(orderId: string, buyerId: string): Promise<void>;
    getBuyOrdersByUser(userId: string): Promise<BuyOrder[]>;
    getActiveBuyOrdersForItem(itemId: string): Promise<BuyOrder[]>;
    matchSellOrder(itemId: string, price: number): Promise<BuyOrder | null>;
}

@injectable()
export class BuyOrderService implements IBuyOrderService {
    private readonly tableName = 'buy_orders';

    constructor(
        @inject("DatabaseService") private databaseService: IDatabaseService
    ) {}

    async createBuyOrder(buyerId: string, itemId: string, price: number): Promise<BuyOrder> {
        const knex = this.databaseService.getKnex();
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

        try {
            await knex(this.tableName).insert(order);
            return order;
        } catch (err) {
            console.error("Error creating buy order", err);
            throw err;
        }
    }

    async cancelBuyOrder(orderId: string, buyerId: string): Promise<void> {
        const knex = this.databaseService.getKnex();
        
        try {
            await knex(this.tableName)
                .where({ 
                    id: orderId, 
                    buyer_id: buyerId, 
                    status: 'active' 
                })
                .update({ 
                    status: 'cancelled', 
                    updated_at: new Date().toISOString() 
                });
        } catch (err) {
            console.error("Error cancelling buy order", err);
            throw err;
        }
    }

    async getBuyOrdersByUser(userId: string): Promise<BuyOrder[]> {
        const knex = this.databaseService.getKnex();
        
        try {
            return await knex(this.tableName)
                .where({ buyer_id: userId })
                .orderBy('created_at', 'desc');
        } catch (err) {
            console.error("Error getting buy orders by user", err);
            throw err;
        }
    }

    async getActiveBuyOrdersForItem(itemId: string): Promise<BuyOrder[]> {
        const knex = this.databaseService.getKnex();
        
        try {
            return await knex(this.tableName)
                .where({ 
                    item_id: itemId, 
                    status: 'active' 
                })
                .orderBy('price', 'desc')
                .orderBy('created_at', 'asc');
        } catch (err) {
            console.error("Error getting active buy orders for item", err);
            throw err;
        }
    }

    async matchSellOrder(itemId: string, sellPrice: number): Promise<BuyOrder | null> {
        const knex = this.databaseService.getKnex();
        
        try {
            const orders = await knex(this.tableName)
                .where({ 
                    item_id: itemId, 
                    status: 'active' 
                })
                .where('price', '>=', sellPrice)
                .orderBy('price', 'desc')
                .orderBy('created_at', 'asc')
                .limit(1);

            return orders.length > 0 ? orders[0] : null;
        } catch (err) {
            console.error("Error matching sell order", err);
            throw err;
        }
    }
}