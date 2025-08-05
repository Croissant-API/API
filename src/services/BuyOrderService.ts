import { v4 as uuidv4 } from "uuid";
import { inject, injectable } from "inversify";
import { BuyOrder } from "../interfaces/BuyOrder";
import { IDatabaseConnection, IDatabaseService } from "./DatabaseService";

export interface IBuyOrderService {
    createBuyOrder(buyerId: string, itemId: string, price: number): Promise<BuyOrder>;
    cancelBuyOrder(orderId: string, buyerId: string): Promise<void>;
    getBuyOrdersByUser(userId: string): Promise<BuyOrder[]>;
    getActiveBuyOrdersForItem(itemId: string): Promise<BuyOrder[]>;
    matchSellOrder(itemId: string, price: number): Promise<BuyOrder | null>;
    processBuyOrderWithTransaction(buyerId: string, itemId: string, price: number): Promise<BuyOrder>;
}

@injectable()
export class BuyOrderService implements IBuyOrderService {
    constructor(
        @inject("DatabaseService") private databaseService: IDatabaseService
    ) {}

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

        await this.databaseService.request(
            `INSERT INTO buy_orders (id, buyer_id, item_id, price, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [order.id, order.buyer_id, order.item_id, order.price, order.status, order.created_at, order.updated_at]
        );

        return order;
    }

    async processBuyOrderWithTransaction(buyerId: string, itemId: string, price: number): Promise<BuyOrder> {
        return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
            // Vérifier le solde de l'utilisateur
            const userBalance = await connection.read<{balance: number}>(
                `SELECT balance FROM users WHERE id = ? FOR UPDATE`,
                [buyerId]
            );

            if (userBalance.length === 0 || userBalance[0].balance < price) {
                throw new Error("Solde insuffisant");
            }

            // Débiter le compte de l'utilisateur
            await connection.request(
                `UPDATE users SET balance = balance - ? WHERE id = ?`,
                [price, buyerId]
            );

            // Créer l'ordre d'achat
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

            await connection.request(
                `INSERT INTO buy_orders (id, buyer_id, item_id, price, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [order.id, order.buyer_id, order.item_id, order.price, order.status, order.created_at, order.updated_at]
            );

            return order;
        });
    }

    async cancelBuyOrder(orderId: string, buyerId: string): Promise<void> {
        await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
            // Récupérer l'ordre
            const orders = await connection.read<BuyOrder>(
                `SELECT * FROM buy_orders WHERE id = ? AND buyer_id = ? AND status = 'active' FOR UPDATE`,
                [orderId, buyerId]
            );

            if (orders.length === 0) {
                throw new Error("Ordre non trouvé ou déjà annulé");
            }

            const order = orders[0];

            // Annuler l'ordre
            await connection.request(
                `UPDATE buy_orders 
                 SET status = 'cancelled', updated_at = ? 
                 WHERE id = ?`,
                [new Date().toISOString(), orderId]
            );

            // Rembourser l'utilisateur
            await connection.request(
                `UPDATE users SET balance = balance + ? WHERE id = ?`,
                [order.price, buyerId]
            );
        });
    }

    async getBuyOrdersByUser(userId: string): Promise<BuyOrder[]> {
        return await this.databaseService.read<BuyOrder>(
            `SELECT * FROM buy_orders 
             WHERE buyer_id = ? 
             ORDER BY created_at DESC`,
            [userId]
        );
    }

    async getActiveBuyOrdersForItem(itemId: string): Promise<BuyOrder[]> {
        return await this.databaseService.read<BuyOrder>(
            `SELECT * FROM buy_orders 
             WHERE item_id = ? AND status = 'active' 
             ORDER BY price DESC, created_at ASC`,
            [itemId]
        );
    }

    async matchSellOrder(itemId: string, sellPrice: number): Promise<BuyOrder | null> {
        const orders = await this.databaseService.read<BuyOrder>(
            `SELECT * FROM buy_orders 
             WHERE item_id = ? AND status = 'active' AND price >= ? 
             ORDER BY price DESC, created_at ASC 
             LIMIT 1`,
            [itemId, sellPrice]
        );

        return orders.length > 0 ? orders[0] : null;
    }
}