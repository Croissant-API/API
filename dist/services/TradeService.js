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
        const itemIds = [...new Set(tradeItems.map(ti => ti.itemId))]; // Remove duplicates
        if (!itemIds.length)
            return []; // Additional safety check
        const items = await this.databaseService.read(`SELECT itemId, name, description, iconHash 
       FROM items 
       WHERE itemId IN (${itemIds.map(() => "?").join(",")}) 
         AND (deleted IS NULL OR deleted = 0)`, itemIds);
        const enrichedItems = [];
        for (const ti of tradeItems) {
            const item = items.find((i) => i.itemId === ti.itemId);
            if (!item) {
                throw new Error(`Item ${ti.itemId} not found or deleted`);
            }
            enrichedItems.push({
                itemId: item.itemId,
                name: item.name,
                description: item.description,
                iconHash: item.iconHash,
                amount: ti.amount,
                uniqueId: ti.metadata?._unique_id,
                metadata: ti.metadata
            });
        }
        return enrichedItems;
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
        const enrichedTrades = [];
        for (const trade of trades) {
            const [fromUserItems, toUserItems] = await Promise.all([
                this.enrichTradeItemsWithSQL(trade.fromUserItems),
                this.enrichTradeItemsWithSQL(trade.toUserItems)
            ]);
            enrichedTrades.push({
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
            });
        }
        return enrichedTrades;
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
        // Vérification différente selon si l'item a des métadonnées ou non
        if (tradeItem.metadata?._unique_id) {
            // Pour les items avec métadonnées, vérifier l'existence spécifique
            const inventoryItems = await this.databaseService.read(`SELECT user_id, item_id, amount FROM inventories 
         WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`, [userId, tradeItem.itemId, tradeItem.metadata._unique_id]);
            if (inventoryItems.length === 0) {
                throw new Error("User does not have this specific item");
            }
        }
        else {
            // Pour les items sans métadonnées, vérifier la quantité disponible
            const hasItem = await this.inventoryService.hasItemWithoutMetadata(userId, tradeItem.itemId, tradeItem.amount);
            if (!hasItem)
                throw new Error("User does not have enough of the item");
        }
        const items = [...trade[userKey]];
        // Pour les items avec _unique_id, ne pas les empiler
        if (tradeItem.metadata?._unique_id) {
            // Vérifier que cet item unique n'est pas déjà dans le trade
            const existingItem = items.find(i => i.itemId === tradeItem.itemId &&
                i.metadata?._unique_id === tradeItem.metadata?._unique_id);
            if (existingItem) {
                throw new Error("This specific item is already in the trade");
            }
            items.push({ ...tradeItem });
        }
        else {
            // Pour les items sans métadonnées, on peut les empiler
            const idx = items.findIndex((i) => i.itemId === tradeItem.itemId && !i.metadata?._unique_id);
            if (idx >= 0) {
                items[idx].amount += tradeItem.amount;
            }
            else {
                items.push({ ...tradeItem });
            }
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
        let idx = -1;
        if (tradeItem.metadata?._unique_id) {
            // Pour les items avec _unique_id, chercher l'item spécifique
            idx = items.findIndex((i) => i.itemId === tradeItem.itemId &&
                i.metadata?._unique_id === tradeItem.metadata?._unique_id);
        }
        else {
            // Pour les items sans métadonnées, chercher un item empilable
            idx = items.findIndex((i) => i.itemId === tradeItem.itemId && !i.metadata?._unique_id);
        }
        if (idx === -1)
            throw new Error("Item not found in trade");
        if (tradeItem.metadata?._unique_id) {
            // Pour les items uniques, les supprimer complètement
            items.splice(idx, 1);
        }
        else {
            // Pour les items empilables, décrémenter la quantité
            if (items[idx].amount < tradeItem.amount)
                throw new Error("Not enough amount to remove");
            items[idx].amount -= tradeItem.amount;
            if (items[idx].amount <= 0) {
                items.splice(idx, 1);
            }
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
        // Pour les items avec _unique_id, utiliser transferItem pour préserver l'ID unique
        // Pour les items sans métadonnées, utiliser la méthode classique remove/add avec gestion de sellable
        for (const item of trade.fromUserItems) {
            if (item.metadata?._unique_id) {
                // Transférer directement l'item avec son unique_id préservé
                await this.inventoryService.transferItem(trade.fromUserId, trade.toUserId, item.itemId, item.metadata._unique_id);
            }
            else {
                // Pour les items sans métadonnées, vérifier s'ils sont sellable
                const inventory = await this.inventoryService.getInventory(trade.fromUserId);
                const inventoryItem = inventory.inventory.find(invItem => invItem.item_id === item.itemId && !invItem.metadata);
                const isSellable = inventoryItem?.sellable || false;
                await this.inventoryService.removeItem(trade.fromUserId, item.itemId, item.amount);
                await this.inventoryService.addItem(trade.toUserId, item.itemId, item.amount, undefined, isSellable);
            }
        }
        for (const item of trade.toUserItems) {
            if (item.metadata?._unique_id) {
                await this.inventoryService.transferItem(trade.toUserId, trade.fromUserId, item.itemId, item.metadata._unique_id);
            }
            else {
                // Pour les items sans métadonnées, vérifier s'ils sont sellable
                const inventory = await this.inventoryService.getInventory(trade.toUserId);
                const inventoryItem = inventory.inventory.find(invItem => invItem.item_id === item.itemId && !invItem.metadata);
                const isSellable = inventoryItem?.sellable || false;
                await this.inventoryService.removeItem(trade.toUserId, item.itemId, item.amount);
                await this.inventoryService.addItem(trade.fromUserId, item.itemId, item.amount, undefined, isSellable);
            }
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
