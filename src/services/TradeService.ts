/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Trade, TradeItem } from "../interfaces/Trade";
import { v4 } from "uuid";
import { IInventoryService } from "./InventoryService";

export interface ITradeService {
    startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
    getTradeById(id: string): Promise<Trade | null>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    addItemToTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    removeItemFromTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
    approveTrade(tradeId: string, userId: string): Promise<void>;
    cancelTrade(tradeId: string, userId: string): Promise<void>;
}

@injectable()
export class TradeService implements ITradeService {
    constructor(
        @inject("DatabaseService") private databaseService: IDatabaseService,
        @inject("InventoryService") private inventoryService: IInventoryService
    ) {}

    async startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade> {
        // Cherche une trade pending entre ces deux users (dans les deux sens)
        const trades = await this.databaseService.read<any[]>(
            `SELECT * FROM trades WHERE status = 'pending' AND ((fromUserId = ? AND toUserId = ?) OR (fromUserId = ? AND toUserId = ?)) ORDER BY createdAt DESC LIMIT 1`,
            [fromUserId, toUserId, toUserId, fromUserId]
        );
        if (trades.length > 0) {
            return this.deserializeTrade(trades[0]);
        }
        // Sinon, crée une nouvelle trade
        const now = new Date().toISOString();
        const id = v4();
        const newTrade: Trade = {
            id,
            fromUserId,
            toUserId,
            fromUserItems: [],
            toUserItems: [],
            approvedFromUser: false,
            approvedToUser: false,
            status: "pending",
            createdAt: now,
            updatedAt: now
        };
        await this.databaseService.create(
            `INSERT INTO trades (id, fromUserId, toUserId, fromUserItems, toUserItems, approvedFromUser, approvedToUser, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newTrade.id,
                newTrade.fromUserId,
                newTrade.toUserId,
                JSON.stringify(newTrade.fromUserItems),
                JSON.stringify(newTrade.toUserItems),
                0,
                0,
                newTrade.status,
                newTrade.createdAt,
                newTrade.updatedAt
            ]
        );
        return newTrade;
    }

    async getTradeById(id: string): Promise<Trade | null> {
        const trades = await this.databaseService.read<any[]>(
            "SELECT * FROM trades WHERE id = ?",
            [id]
        );
        if (trades.length === 0) return null;
        return this.deserializeTrade(trades[0]);
    }

    async getTradesByUser(userId: string): Promise<Trade[]> {
        const trades = await this.databaseService.read<any[]>(
            "SELECT * FROM trades WHERE fromUserId = ? OR toUserId = ? ORDER BY createdAt DESC",
            [userId, userId]
        );
        return trades.map(this.deserializeTrade);
    }

    async addItemToTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void> {
        const trade = await this.getTradeById(tradeId);
        if (!trade) throw new Error("Trade not found");
        if (trade.status !== "pending") throw new Error("Trade is not pending");
        let userKey: "fromUserItems" | "toUserItems";
        if (trade.fromUserId === userId) userKey = "fromUserItems";
        else if (trade.toUserId === userId) userKey = "toUserItems";
        else throw new Error("User not part of this trade");

        // Check if user has enough items
        const hasItem = await this.inventoryService.hasItem(userId, tradeItem.itemId, tradeItem.amount);
        if (!hasItem) throw new Error("User does not have enough of the item");

        // Ajoute ou update l'item dans la liste
        const items = [...trade[userKey]];
        const idx = items.findIndex(i => i.itemId === tradeItem.itemId);
        if (idx >= 0) items[idx].amount += tradeItem.amount;
        else items.push({ ...tradeItem });
        trade[userKey] = items;
        trade.updatedAt = new Date().toISOString();
        trade.approvedFromUser = false;
        trade.approvedToUser = false;
        await this.databaseService.update(
            `UPDATE trades SET ${userKey} = ?, approvedFromUser = 0, approvedToUser = 0, updatedAt = ? WHERE id = ?`,
            [JSON.stringify(items), trade.updatedAt, tradeId]
        );
    }

    async removeItemFromTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void> {
        const trade = await this.getTradeById(tradeId);
        if (!trade) throw new Error("Trade not found");
        if (trade.status !== "pending") throw new Error("Trade is not pending");
        let userKey: "fromUserItems" | "toUserItems";
        if (trade.fromUserId === userId) userKey = "fromUserItems";
        else if (trade.toUserId === userId) userKey = "toUserItems";
        else throw new Error("User not part of this trade");

        const items = [...trade[userKey]];
        const idx = items.findIndex(i => i.itemId === tradeItem.itemId);
        if (idx === -1) throw new Error("Item not found in trade");
        if (items[idx].amount < tradeItem.amount) throw new Error("Not enough amount to remove");
        items[idx].amount -= tradeItem.amount;
        if (items[idx].amount <= 0) items.splice(idx, 1);
        trade[userKey] = items;
        trade.updatedAt = new Date().toISOString();
        trade.approvedFromUser = false;
        trade.approvedToUser = false;
        await this.databaseService.update(
            `UPDATE trades SET ${userKey} = ?, approvedFromUser = 0, approvedToUser = 0, updatedAt = ? WHERE id = ?`,
            [JSON.stringify(items), trade.updatedAt, tradeId]
        );
    }

    async approveTrade(tradeId: string, userId: string): Promise<void> {
        const trade = await this.getTradeById(tradeId);
        if (!trade) throw new Error("Trade not found");
        if (trade.status !== "pending") throw new Error("Trade is not pending");
        let updateField = "";
        if (trade.fromUserId === userId) updateField = "approvedFromUser";
        else if (trade.toUserId === userId) updateField = "approvedToUser";
        else throw new Error("User not part of this trade");

        trade[updateField as "approvedFromUser" | "approvedToUser"] = true;
        trade.updatedAt = new Date().toISOString();
        await this.databaseService.update(
            `UPDATE trades SET ${updateField} = 1, updatedAt = ? WHERE id = ?`,
            [trade.updatedAt, tradeId]
        );

        // Si les deux ont approuvé, on échange les items et on passe à completed
        const refreshed = await this.getTradeById(tradeId);
        if (refreshed && refreshed.approvedFromUser && refreshed.approvedToUser) {
            await this.exchangeTradeItems(refreshed);
        }
    }

    async cancelTrade(tradeId: string, userId: string): Promise<void> {
        const trade = await this.getTradeById(tradeId);
        if (!trade) throw new Error("Trade not found");
        if (trade.status !== "pending") throw new Error("Trade is not pending");
        if (trade.fromUserId !== userId && trade.toUserId !== userId) throw new Error("User not part of this trade");
        trade.status = "canceled";
        trade.updatedAt = new Date().toISOString();
        await this.databaseService.update(
            `UPDATE trades SET status = ?, updatedAt = ? WHERE id = ?`,
            [trade.status, trade.updatedAt, tradeId]
        );
    }

    // Échange les items et passe la trade à completed
    private async exchangeTradeItems(trade: Trade): Promise<void> {
        // Retire les items des inventaires
        for (const item of trade.fromUserItems) {
            await this.inventoryService.removeItem(trade.fromUserId, item.itemId, item.amount);
        }
        for (const item of trade.toUserItems) {
            await this.inventoryService.removeItem(trade.toUserId, item.itemId, item.amount);
        }
        // Ajoute les items à l'autre user
        for (const item of trade.fromUserItems) {
            await this.inventoryService.addItem(trade.toUserId, item.itemId, item.amount);
        }
        for (const item of trade.toUserItems) {
            await this.inventoryService.addItem(trade.fromUserId, item.itemId, item.amount);
        }
        // Met à jour la trade
        const now = new Date().toISOString();
        await this.databaseService.update(
            `UPDATE trades SET status = 'completed', updatedAt = ? WHERE id = ?`,
            [now, trade.id]
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private deserializeTrade = (row: any): Trade => ({
        ...row,
        fromUserItems: JSON.parse(row.fromUserItems),
        toUserItems: JSON.parse(row.toUserItems),
        approvedFromUser: !!row.approvedFromUser,
        approvedToUser: !!row.approvedToUser,
    });
}
