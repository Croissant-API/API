var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { inject, injectable } from "inversify";
import { v4 } from "uuid";
let TradeService = class TradeService {
    constructor(databaseService, inventoryService) {
        this.databaseService = databaseService;
        this.inventoryService = inventoryService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.deserializeTrade = (row) => ({
            ...row,
            fromUserItems: JSON.parse(row.fromUserItems),
            toUserItems: JSON.parse(row.toUserItems),
            approvedFromUser: !!row.approvedFromUser,
            approvedToUser: !!row.approvedToUser,
        });
    }
    async createTrade(trade) {
        const uniqueId = v4(); // Generate a unique ID for the trade
        this.databaseService.create(`INSERT INTO trades 
                (fromUserId, toUserId, fromUserItems, toUserItems, approvedFromUser, approvedToUser, uniqueId, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            trade.fromUserId,
            trade.toUserId,
            JSON.stringify(trade.fromUserItems),
            JSON.stringify(trade.toUserItems),
            trade.approvedFromUser,
            trade.approvedToUser,
            uniqueId,
            'pending',
        ]);
        return trade;
    }
    async getTradeById(id) {
        const trades = await this.databaseService.read("SELECT * FROM trades WHERE id = ?", [id]);
        if (trades.length === 0)
            return null;
        return this.deserializeTrade(trades[0]);
    }
    async getTradesByUser(userId) {
        const trades = await this.databaseService.read("SELECT * FROM trades WHERE fromUserId = ? OR toUserId = ?", [userId, userId]);
        return trades.map(this.deserializeTrade);
    }
    async updateTradeStatus(id, status) {
        await this.databaseService.update("UPDATE trades SET status = ? WHERE id = ?", [status, id]);
    }
    async approveTrade(id, userId) {
        const trade = await this.getTradeById(id);
        if (!trade)
            return;
        if (trade.fromUserId === userId) {
            await this.databaseService.update("UPDATE trades SET approvedFromUser = ? WHERE id = ?", [true, id]);
        }
        else if (trade.toUserId === userId) {
            await this.databaseService.update("UPDATE trades SET approvedToUser = ? WHERE id = ?", [true, id]);
        }
    }
    async deleteTrade(id) {
        await this.databaseService.delete("DELETE FROM trades WHERE id = ?", [id]);
    }
    async addItemToTrade(tradeId, userKey, tradeItem) {
        const trade = await this.getTradeById(tradeId);
        if (!trade)
            return;
        // Determine which user is adding the item
        const userId = userKey === "fromUserItems" ? trade.fromUserId : trade.toUserId;
        // Check if user has the item in their inventory
        const hasItem = await this.inventoryService.hasItem(userId, tradeItem.itemId, tradeItem.amount);
        if (!hasItem) {
            throw new Error("User does not have enough of the item to add to trade");
        }
        const items = [...trade[userKey], tradeItem];
        await this.databaseService.update(`UPDATE trades SET ${userKey} = ? WHERE id = ?`, [JSON.stringify(items), tradeId]);
    }
    async removeItemToTrade(tradeId, userKey, tradePredicate) {
        const trade = await this.getTradeById(tradeId);
        if (!trade)
            return;
        if (!trade[userKey])
            return;
        const tradeItems = trade[userKey];
        const item = tradeItems.find(item => item.itemId === tradePredicate.itemId) || null;
        if (!item)
            return;
        item.amount -= tradePredicate.amount;
        const items = tradeItems
            .filter((item) => item.amount > 0);
        trade[userKey] = items;
        await this.databaseService.update(`UPDATE trades SET ${userKey} = ? WHERE id = ?`, [JSON.stringify(trade[userKey]), tradeId]);
    }
    async exchangeTradeItems(tradeId, fromUserId, toUserId) {
        const trade = await this.getTradeById(tradeId);
        if (!trade)
            return;
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
};
TradeService = __decorate([
    injectable(),
    __param(0, inject("DatabaseService")),
    __param(1, inject("InventoryService")),
    __metadata("design:paramtypes", [Object, Object])
], TradeService);
export { TradeService };
