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
    constructor(databaseService, inventoryService) {
        this.databaseService = databaseService;
        this.inventoryService = inventoryService;
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
        const trades = await this.databaseService.read(`SELECT * FROM trades 
       WHERE status = 'pending' 
         AND ((fromUserId = ? AND toUserId = ?) OR (fromUserId = ? AND toUserId = ?)) 
       ORDER BY createdAt DESC 
       LIMIT 1`, [fromUserId, toUserId, toUserId, fromUserId]);
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
            updatedAt: now,
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
            newTrade.updatedAt,
        ]);
        return newTrade;
    }
    async enrichTradeItemsWithSQL(tradeItems) {
        if (!tradeItems.length)
            return [];
        const itemIds = tradeItems.map(ti => ti.itemId);
        const items = await this.databaseService.read(`SELECT itemId, name, description, iconHash 
       FROM items 
       WHERE itemId IN (${itemIds.map(() => "?").join(",")}) 
         AND (deleted IS NULL OR deleted = 0)`, itemIds);
        return tradeItems.map(ti => {
            const item = items.find((i) => i.itemId === ti.itemId);
            if (!item) {
                throw new Error(`Item ${ti.itemId} not found or deleted`);
            }
            return {
                itemId: item.itemId,
                name: item.name,
                description: item.description,
                iconHash: item.iconHash,
                amount: ti.amount
            };
        });
    }
    async getTradeById(id) {
        const trades = await this.databaseService.read("SELECT * FROM trades WHERE id = ?", [id]);
        if (trades.length === 0)
            return null;
        return this.deserializeTrade(trades[0]);
    }
    async getFormattedTradeById(id) {
        const trade = await this.getTradeById(id);
        if (!trade)
            return null;
        const [fromUserItems, toUserItems] = await Promise.all([
            this.enrichTradeItemsWithSQL(trade.fromUserItems),
            this.enrichTradeItemsWithSQL(trade.toUserItems)
        ]);
        return {
            id: trade.id,
            fromUserId: trade.fromUserId,
            toUserId: trade.toUserId,
            fromUserItems,
            toUserItems,
            approvedFromUser: trade.approvedFromUser,
            approvedToUser: trade.approvedToUser,
            status: trade.status,
            createdAt: trade.createdAt,
            updatedAt: trade.updatedAt
        };
    }
    async getTradesByUser(userId) {
        const trades = await this.databaseService.read("SELECT * FROM trades WHERE fromUserId = ? OR toUserId = ? ORDER BY createdAt DESC", [userId, userId]);
        return trades.map(this.deserializeTrade);
    }
    async getFormattedTradesByUser(userId) {
        const trades = await this.getTradesByUser(userId);
        // Collecte tous les itemIds uniques de toutes les trades
        const allItemIds = new Set();
        trades.forEach(trade => {
            trade.fromUserItems.forEach(item => allItemIds.add(item.itemId));
            trade.toUserItems.forEach(item => allItemIds.add(item.itemId));
        });
        if (allItemIds.size === 0) {
            return trades.map(trade => ({
                id: trade.id,
                fromUserId: trade.fromUserId,
                toUserId: trade.toUserId,
                fromUserItems: [],
                toUserItems: [],
                approvedFromUser: trade.approvedFromUser,
                approvedToUser: trade.approvedToUser,
                status: trade.status,
                createdAt: trade.createdAt,
                updatedAt: trade.updatedAt
            }));
        }
        // Une seule requête pour récupérer tous les items
        const itemsArray = Array.from(allItemIds);
        const items = await this.databaseService.read(`SELECT itemId, name, description, iconHash 
       FROM items 
       WHERE itemId IN (${itemsArray.map(() => "?").join(",")}) 
         AND (deleted IS NULL OR deleted = 0)`, itemsArray);
        // Crée un map pour un accès O(1)
        const itemsMap = new Map(items.map((item) => [item.itemId, item]));
        return trades.map(trade => {
            const enrichItem = (tradeItem) => {
                const item = itemsMap.get(tradeItem.itemId);
                if (!item) {
                    throw new Error(`Item ${tradeItem.itemId} not found or deleted`);
                }
                return {
                    itemId: item.itemId,
                    name: item.name,
                    description: item.description,
                    iconHash: item.iconHash,
                    amount: tradeItem.amount
                };
            };
            return {
                id: trade.id,
                fromUserId: trade.fromUserId,
                toUserId: trade.toUserId,
                fromUserItems: trade.fromUserItems.map(enrichItem),
                toUserItems: trade.toUserItems.map(enrichItem),
                approvedFromUser: trade.approvedFromUser,
                approvedToUser: trade.approvedToUser,
                status: trade.status,
                createdAt: trade.createdAt,
                updatedAt: trade.updatedAt
            };
        });
    }
    getUserKey(trade, userId) {
        if (trade.fromUserId === userId)
            return "fromUserItems";
        if (trade.toUserId === userId)
            return "toUserItems";
        throw new Error("User not part of this trade");
    }
    assertPending(trade) {
        if (trade.status !== "pending")
            throw new Error("Trade is not pending");
    }
    async addItemToTrade(tradeId, userId, tradeItem) {
        const trade = await this.getTradeById(tradeId);
        if (!trade)
            throw new Error("Trade not found");
        this.assertPending(trade);
        const userKey = this.getUserKey(trade, userId);
        const hasItem = await this.inventoryService.hasItem(userId, tradeItem.itemId, tradeItem.amount);
        if (!hasItem)
            throw new Error("User does not have enough of the item");
        const items = [...trade[userKey]];
        const idx = items.findIndex((i) => i.itemId === tradeItem.itemId);
        if (idx >= 0) {
            items[idx].amount += tradeItem.amount;
        }
        else {
            items.push({ ...tradeItem });
        }
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
        this.assertPending(trade);
        const userKey = this.getUserKey(trade, userId);
        const items = [...trade[userKey]];
        const idx = items.findIndex((i) => i.itemId === tradeItem.itemId);
        if (idx === -1)
            throw new Error("Item not found in trade");
        if (items[idx].amount < tradeItem.amount)
            throw new Error("Not enough amount to remove");
        items[idx].amount -= tradeItem.amount;
        if (items[idx].amount <= 0) {
            items.splice(idx, 1);
        }
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
        this.assertPending(trade);
        const updateField = trade.fromUserId === userId ? "approvedFromUser" :
            trade.toUserId === userId ? "approvedToUser" : null;
        if (!updateField)
            throw new Error("User not part of this trade");
        const updatedAt = new Date().toISOString();
        await this.databaseService.update(`UPDATE trades SET ${updateField} = 1, updatedAt = ? WHERE id = ?`, [updatedAt, tradeId]);
        // Récupère la trade mise à jour pour vérifier l'état actuel
        const updatedTrade = await this.getTradeById(tradeId);
        if (!updatedTrade)
            throw new Error("Trade not found after update");
        // Vérifie si les deux utilisateurs ont approuvé
        if (updatedTrade.approvedFromUser && updatedTrade.approvedToUser) {
            await this.exchangeTradeItems(updatedTrade);
        }
    }
    async cancelTrade(tradeId, userId) {
        const trade = await this.getTradeById(tradeId);
        if (!trade)
            throw new Error("Trade not found");
        this.assertPending(trade);
        if (trade.fromUserId !== userId && trade.toUserId !== userId) {
            throw new Error("User not part of this trade");
        }
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
    __metadata("design:paramtypes", [Object, Object])
], TradeService);
exports.TradeService = TradeService;
