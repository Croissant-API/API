"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const inversify_1 = require("inversify");
const uuid_1 = require("uuid");
let TradeService = class TradeService {
    constructor(databaseService, inventoryService, itemService // <-- à injecter
    ) {
        this.databaseService = databaseService;
        this.inventoryService = inventoryService;
        this.itemService = itemService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.deserializeTrade = (row) => ({
            ...row,
            fromUserItems: JSON.parse(row.fromUserItems),
            toUserItems: JSON.parse(row.toUserItems),
            approvedFromUser: !!row.approvedFromUser,
            approvedToUser: !!row.approvedToUser,
        });
    }
    async startOrGetPendingTrade(fromUserId, toUserId) {
        // Cherche une trade pending entre ces deux users (dans les deux sens)
        const trades = await this.databaseService.read(`SELECT * FROM trades WHERE status = 'pending' AND ((fromUserId = ? AND toUserId = ?) OR (fromUserId = ? AND toUserId = ?)) ORDER BY createdAt DESC LIMIT 1`, [fromUserId, toUserId, toUserId, fromUserId]);
        if (trades.length > 0) {
            return this.deserializeTrade(trades[0]);
        }
        // Sinon, crée une nouvelle trade
        const now = new Date().toISOString();
        const id = (0, uuid_1.v4)();
        const newTrade = {
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
        await this.databaseService.create(`INSERT INTO trades (id, fromUserId, toUserId, fromUserItems, toUserItems, approvedFromUser, approvedToUser, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
        ]);
        return newTrade;
    }
    async enrichTradeItems(trade) {
        // Remplace chaque itemId par l'objet complet
        const enrich = async (tradeItems) => {
            return Promise.all(tradeItems.map(async (ti) => {
                const item = await this.itemService.getItem(ti.itemId);
                if (!item || !item.itemId) {
                    throw new Error("Item not found or missing itemId");
                }
                return { ...item, itemId: item.itemId, amount: ti.amount };
            }));
        };
        return {
            ...trade,
            fromUserItems: await enrich(trade.fromUserItems),
            toUserItems: await enrich(trade.toUserItems),
        };
    }
    async getTradeById(id) {
        const trades = await this.databaseService.read("SELECT * FROM trades WHERE id = ?", [id]);
        if (trades.length === 0)
            return null;
        const trade = this.deserializeTrade(trades[0]);
        return await this.enrichTradeItems(trade);
    }
    async getTradesByUser(userId) {
        const trades = await this.databaseService.read("SELECT * FROM trades WHERE fromUserId = ? OR toUserId = ? ORDER BY createdAt DESC", [userId, userId]);
        const deserialized = trades.map(this.deserializeTrade);
        return Promise.all(deserialized.map(t => this.enrichTradeItems(t)));
    }
    async addItemToTrade(tradeId, userId, tradeItem) {
        const trade = await this.getTradeById(tradeId);
        if (!trade)
            throw new Error("Trade not found");
        if (trade.status !== "pending")
            throw new Error("Trade is not pending");
        let userKey;
        if (trade.fromUserId === userId)
            userKey = "fromUserItems";
        else if (trade.toUserId === userId)
            userKey = "toUserItems";
        else
            throw new Error("User not part of this trade");
        // Check if user has enough items
        const hasItem = await this.inventoryService.hasItem(userId, tradeItem.itemId, tradeItem.amount);
        if (!hasItem)
            throw new Error("User does not have enough of the item");
        // Ajoute ou update l'item dans la liste
        const items = [...trade[userKey]];
        const idx = items.findIndex(i => i.itemId === tradeItem.itemId);
        if (idx >= 0)
            items[idx].amount += tradeItem.amount;
        else
            items.push({ ...tradeItem });
        trade[userKey] = items;
        trade.updatedAt = new Date().toISOString();
        trade.approvedFromUser = false;
        trade.approvedToUser = false;
        await this.databaseService.update(`UPDATE trades SET ${userKey} = ?, approvedFromUser = 0, approvedToUser = 0, updatedAt = ? WHERE id = ?`, [JSON.stringify(items), trade.updatedAt, tradeId]);
    }
    async removeItemFromTrade(tradeId, userId, tradeItem) {
        const trade = await this.getTradeById(tradeId);
        if (!trade)
            throw new Error("Trade not found");
        if (trade.status !== "pending")
            throw new Error("Trade is not pending");
        let userKey;
        if (trade.fromUserId === userId)
            userKey = "fromUserItems";
        else if (trade.toUserId === userId)
            userKey = "toUserItems";
        else
            throw new Error("User not part of this trade");
        const items = [...trade[userKey]];
        const idx = items.findIndex(i => i.itemId === tradeItem.itemId);
        if (idx === -1)
            throw new Error("Item not found in trade");
        if (items[idx].amount < tradeItem.amount)
            throw new Error("Not enough amount to remove");
        items[idx].amount -= tradeItem.amount;
        if (items[idx].amount <= 0)
            items.splice(idx, 1);
        trade[userKey] = items;
        trade.updatedAt = new Date().toISOString();
        trade.approvedFromUser = false;
        trade.approvedToUser = false;
        await this.databaseService.update(`UPDATE trades SET ${userKey} = ?, approvedFromUser = 0, approvedToUser = 0, updatedAt = ? WHERE id = ?`, [JSON.stringify(items), trade.updatedAt, tradeId]);
    }
    async approveTrade(tradeId, userId) {
        const trade = await this.getTradeById(tradeId);
        if (!trade)
            throw new Error("Trade not found");
        if (trade.status !== "pending")
            throw new Error("Trade is not pending");
        let updateField = "";
        if (trade.fromUserId === userId)
            updateField = "approvedFromUser";
        else if (trade.toUserId === userId)
            updateField = "approvedToUser";
        else
            throw new Error("User not part of this trade");
        trade[updateField] = true;
        trade.updatedAt = new Date().toISOString();
        await this.databaseService.update(`UPDATE trades SET ${updateField} = 1, updatedAt = ? WHERE id = ?`, [trade.updatedAt, tradeId]);
        // Si les deux ont approuvé, on échange les items et on passe à completed
        if (trade.approvedFromUser && trade.approvedToUser) {
            await this.exchangeTradeItems(trade);
        }
    }
    async cancelTrade(tradeId, userId) {
        const trade = await this.getTradeById(tradeId);
        if (!trade)
            throw new Error("Trade not found");
        if (trade.status !== "pending")
            throw new Error("Trade is not pending");
        if (trade.fromUserId !== userId && trade.toUserId !== userId)
            throw new Error("User not part of this trade");
        trade.status = "canceled";
        trade.updatedAt = new Date().toISOString();
        await this.databaseService.update(`UPDATE trades SET status = ?, updatedAt = ? WHERE id = ?`, [trade.status, trade.updatedAt, tradeId]);
    }
    // Échange les items et passe la trade à completed
    async exchangeTradeItems(trade) {
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
        await this.databaseService.update(`UPDATE trades SET status = 'completed', updatedAt = ? WHERE id = ?`, [now, trade.id]);
    }
};
TradeService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __param(1, (0, inversify_1.inject)("InventoryService")),
    __param(2, (0, inversify_1.inject)("ItemService")),
    __metadata("design:paramtypes", [Object, Object, Object])
], TradeService);
exports.TradeService = TradeService;
