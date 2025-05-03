import { inject, injectable } from "inversify";
import { IDatabaseService } from "./database";
import { Trade, TradeItem } from "../interfaces/Trade";

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
        @inject("DatabaseService") private databaseService: IDatabaseService
    ) {}

    async createTrade(trade: Omit<Trade, "id">): Promise<Omit<Trade, "id">> {
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
                trade.uniqueId,
                trade.status
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private deserializeTrade = (row: any): Trade => ({
        ...row,
        fromUserItems: JSON.parse(row.fromUserItems),
        toUserItems: JSON.parse(row.toUserItems),
        approvedFromUser: !!row.approvedFromUser,
        approvedToUser: !!row.approvedToUser,
    });
}
