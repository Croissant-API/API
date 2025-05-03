import { inject, injectable } from "inversify";
import { IDatabaseService } from "./database";
import { Trade, TradeItem } from "../interfaces/Trade";
import { v4 } from "uuid";
import { IInventoryService } from "./InventoryService";

export interface ITradeService {
    createTrade(trade: Omit<Trade, "id">): Promise<Omit<Trade, "id">>;
    getTradeById(id: string): Promise<Trade | null>;
    getTradesByUser(userId: string): Promise<Trade[]>;
    updateTradeStatus(id: string, status: string): Promise<void>;
    approveTrade(id: string, userId: string): Promise<void>;
    deleteTrade(id: string): Promise<void>;
    addItemToTrade(
        tradeId: string,
        userKey: "fromUserItems" | "toUserItems",
        tradeItem: TradeItem
    ): Promise<void>;
    removeItemToTrade(
        tradeId: string,
        userKey: "fromUserItems" | "toUserItems",
        tradeItem: TradeItem
    ): Promise<void>;

}

@injectable()
export class TradeService implements ITradeService {
    constructor(
        @inject("DatabaseService") private databaseService: IDatabaseService,
        @inject("InventoryService") private inventoryService: IInventoryService
    ) {}

    async createTrade(trade: Omit<Trade, "id">): Promise<Omit<Trade, "id">> {
        const uniqueId = v4(); // Generate a unique ID for the trade
        this.databaseService.create(
            `INSERT INTO trades 
                (fromUserId, toUserId, fromUserItems, toUserItems, approvedFromUser, approvedToUser, uniqueId, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                trade.fromUserId,
                trade.toUserId,
                JSON.stringify(trade.fromUserItems),
                JSON.stringify(trade.toUserItems),
                trade.approvedFromUser,
                trade.approvedToUser,
                uniqueId,
                'pending',
            ]
        );
        return trade;
    }

    async getTradeById(id: string): Promise<Trade | null> {
        const trades = await this.databaseService.read<Trade[]>(
            "SELECT * FROM trades WHERE id = ?",
            [id]
        );
        if (trades.length === 0) return null;
        return this.deserializeTrade(trades[0]);
    }

    async getTradesByUser(userId: string): Promise<Trade[]> {
        const trades = await this.databaseService.read<Trade[]>(
            "SELECT * FROM trades WHERE fromUserId = ? OR toUserId = ?",
            [userId, userId]
        );
        return trades.map(this.deserializeTrade);
    }

    async updateTradeStatus(id: string, status: string): Promise<void> {
        await this.databaseService.update(
            "UPDATE trades SET status = ? WHERE id = ?",
            [status, id]
        );
    }

    async approveTrade(id: string, userId: string): Promise<void> {
        const trade = await this.getTradeById(id);
        if (!trade) return;
        if (trade.fromUserId === userId) {
            await this.databaseService.update(
                "UPDATE trades SET approvedFromUser = ? WHERE id = ?",
                [true, id]
            );
        } else if (trade.toUserId === userId) {
            await this.databaseService.update(
                "UPDATE trades SET approvedToUser = ? WHERE id = ?",
                [true, id]
            );
        }
    }

    async deleteTrade(id: string): Promise<void> {
        await this.databaseService.delete(
            "DELETE FROM trades WHERE id = ?",
            [id]
        );
    }

    async addItemToTrade(
        tradeId: string,
        userKey: "fromUserItems" | "toUserItems",
        tradeItem: TradeItem
    ): Promise<void> {
        const trade = await this.getTradeById(tradeId);
        if (!trade) return;

        // Determine which user is adding the item
        const userId = userKey === "fromUserItems" ? trade.fromUserId : trade.toUserId;

        // Check if user has the item in their inventory
        const hasItem = await this.inventoryService.hasItem(userId, tradeItem.itemId, tradeItem.amount);
        if (!hasItem) {
            throw new Error("User does not have enough of the item to add to trade");
        }

        const items = [...trade[userKey], tradeItem];
        await this.databaseService.update(
            `UPDATE trades SET ${userKey} = ? WHERE id = ?`,
            [JSON.stringify(items), tradeId]
        );
    }
    async removeItemToTrade(
        tradeId: string,
        userKey: "fromUserItems" | "toUserItems",
        tradePredicate: TradeItem
    ): Promise<void> {
        const trade = await this.getTradeById(tradeId);
        if (!trade) return;
        if(!trade[userKey]) return;

        const tradeItems = trade[userKey];
        const item: TradeItem | null = tradeItems.find(item => item.itemId === tradePredicate.itemId) || null;
        if(!item) return;
        
        item.amount -= tradePredicate.amount;
        const items = tradeItems
            .filter(
                (item: TradeItem) => item.amount > 0
            );
        trade[userKey] = items;

        await this.databaseService.update(
            `UPDATE trades SET ${userKey} = ? WHERE id = ?`,
            [JSON.stringify(trade[userKey]), tradeId]
        );
    }

    async exchangeTradeItems(
        tradeId: string,
        fromUserId: string,
        toUserId: string
    ): Promise<void> {
        const trade = await this.getTradeById(tradeId);
        if (!trade) return;
        if (trade.fromUserId !== fromUserId || trade.toUserId !== toUserId) {
            throw new Error("Trade does not belong to the user");
        }
        if (!trade.approvedFromUser || !trade.approvedToUser) {
            throw new Error("Trade not approved by both users");
        }
        if (trade.status !== "pending") {
            throw new Error("Trade is not pending");
        }

        const fromUserItems = trade.fromUserItems;
        const toUserItems = trade.toUserItems;

        // Remove items from the inventories of both users
        for (const item of fromUserItems) {
            await this.inventoryService.removeItem(fromUserId, item.itemId, item.amount);
        }
        for (const item of toUserItems) {
            await this.inventoryService.removeItem(toUserId, item.itemId, item.amount);
        }
        // Add items to the inventories of both users
        for (const item of fromUserItems) {
            await this.inventoryService.addItem(toUserId, item.itemId, item.amount);
        }
        for (const item of toUserItems) {
            await this.inventoryService.addItem(fromUserId, item.itemId, item.amount);
        }

        // After the exchange, you might want to update the trade status
        await this.updateTradeStatus(tradeId, "completed");
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
