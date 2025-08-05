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
const inversify_1 = require("inversify");
const uuid_1 = require("uuid");
let TradeService = class TradeService {
    constructor(databaseService, inventoryService) {
        this.databaseService = databaseService;
        this.inventoryService = inventoryService;
    }
    async startOrGetPendingTrade(fromUserId, toUserId) {
        // Cherche une trade pending entre ces deux users (dans les deux sens)
        const trades = await this.databaseService.read(`SELECT * FROM trades 
       WHERE status = 'pending' 
         AND ((fromUserId = ? AND toUserId = ?) OR (fromUserId = ? AND toUserId = ?)) 
       ORDER BY createdAt DESC 
       LIMIT 1`, [fromUserId, toUserId, toUserId, fromUserId]);
        if (trades.length > 0) {
            return trades[0];
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
        await this.databaseService.request(`INSERT INTO trades (id, fromUserId, toUserId, fromUserItems, toUserItems, approvedFromUser, approvedToUser, status, createdAt, updatedAt)
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
    async getTradeById(id) {
        const trades = await this.databaseService.read("SELECT * FROM trades WHERE id = ?", [id]);
        if (trades.length === 0)
            return null;
        return trades[0];
    }
    async getFormattedTradeById(id) {
        const query = `
      SELECT 
        t.id,
        t.fromUserId,
        t.toUserId,
        t.approvedFromUser,
        t.approvedToUser,
        t.status,
        t.createdAt,
        t.updatedAt,
        (
          SELECT json_group_array(
            CASE WHEN json_extract(fromItem.value, '$.itemId') IS NOT NULL AND i1.itemId IS NOT NULL THEN
              json_object(
                'itemId', json_extract(fromItem.value, '$.itemId'),
                'name', i1.name,
                'description', i1.description,
                'iconHash', i1.iconHash,
                'amount', json_extract(fromItem.value, '$.amount'),
                'uniqueId', json_extract(fromItem.value, '$.metadata._unique_id'),
                'metadata', CASE WHEN json_extract(fromItem.value, '$.metadata') IS NOT NULL THEN json(json_extract(fromItem.value, '$.metadata')) ELSE NULL END,
                'purchasePrice', json_extract(fromItem.value, '$.purchasePrice')
              )
            END
          )
          FROM json_each(t.fromUserItems) AS fromItem
          LEFT JOIN items i1 ON json_extract(fromItem.value, '$.itemId') = i1.itemId 
            AND (i1.deleted IS NULL OR i1.deleted = 0)
          WHERE json_extract(fromItem.value, '$.itemId') IS NOT NULL
        ) as fromUserItems,
        (
          SELECT json_group_array(
            CASE WHEN json_extract(toItem.value, '$.itemId') IS NOT NULL AND i2.itemId IS NOT NULL THEN
              json_object(
                'itemId', json_extract(toItem.value, '$.itemId'),
                'name', i2.name,
                'description', i2.description,
                'iconHash', i2.iconHash,
                'amount', json_extract(toItem.value, '$.amount'),
                'uniqueId', json_extract(toItem.value, '$.metadata._unique_id'),
                'metadata', CASE WHEN json_extract(toItem.value, '$.metadata') IS NOT NULL THEN json(json_extract(toItem.value, '$.metadata')) ELSE NULL END,
                'purchasePrice', json_extract(toItem.value, '$.purchasePrice')
              )
            END
          )
          FROM json_each(t.toUserItems) AS toItem
          LEFT JOIN items i2 ON json_extract(toItem.value, '$.itemId') = i2.itemId 
            AND (i2.deleted IS NULL OR i2.deleted = 0)
          WHERE json_extract(toItem.value, '$.itemId') IS NOT NULL
        ) as toUserItems
      FROM trades t
      WHERE t.id = ?
    `;
        const results = await this.databaseService.read(query, [id]);
        if (results.length === 0)
            return null;
        const trade = results[0];
        return {
            id: trade.id,
            fromUserId: trade.fromUserId,
            toUserId: trade.toUserId,
            fromUserItems: trade.fromUserItems,
            toUserItems: trade.toUserItems,
            approvedFromUser: !!trade.approvedFromUser,
            approvedToUser: !!trade.approvedToUser,
            status: trade.status,
            createdAt: trade.createdAt,
            updatedAt: trade.updatedAt
        };
    }
    async getTradesByUser(userId) {
        const trades = await this.databaseService.read("SELECT * FROM trades WHERE fromUserId = ? OR toUserId = ? ORDER BY createdAt DESC", [userId, userId]);
        return trades;
    }
    async getFormattedTradesByUser(userId) {
        const query = `
      SELECT 
        t.id,
        t.fromUserId,
        t.toUserId,
        t.approvedFromUser,
        t.approvedToUser,
        t.status,
        t.createdAt,
        t.updatedAt,
        (
          SELECT json_group_array(
            CASE WHEN json_extract(fromItem.value, '$.itemId') IS NOT NULL AND i1.itemId IS NOT NULL THEN
              json_object(
                'itemId', json_extract(fromItem.value, '$.itemId'),
                'name', i1.name,
                'description', i1.description,
                'iconHash', i1.iconHash,
                'amount', json_extract(fromItem.value, '$.amount'),
                'uniqueId', json_extract(fromItem.value, '$.metadata._unique_id'),
                'metadata', CASE WHEN json_extract(fromItem.value, '$.metadata') IS NOT NULL THEN json(json_extract(fromItem.value, '$.metadata')) ELSE NULL END,
                'purchasePrice', json_extract(fromItem.value, '$.purchasePrice')
              )
            END
          )
          FROM json_each(t.fromUserItems) AS fromItem
          LEFT JOIN items i1 ON json_extract(fromItem.value, '$.itemId') = i1.itemId 
            AND (i1.deleted IS NULL OR i1.deleted = 0)
          WHERE json_extract(fromItem.value, '$.itemId') IS NOT NULL
        ) as fromUserItems,
        (
          SELECT json_group_array(
            CASE WHEN json_extract(toItem.value, '$.itemId') IS NOT NULL AND i2.itemId IS NOT NULL THEN
              json_object(
                'itemId', json_extract(toItem.value, '$.itemId'),
                'name', i2.name,
                'description', i2.description,
                'iconHash', i2.iconHash,
                'amount', json_extract(toItem.value, '$.amount'),
                'uniqueId', json_extract(toItem.value, '$.metadata._unique_id'),
                'metadata', CASE WHEN json_extract(toItem.value, '$.metadata') IS NOT NULL THEN json(json_extract(toItem.value, '$.metadata')) ELSE NULL END,
                'purchasePrice', json_extract(toItem.value, '$.purchasePrice')
              )
            END
          )
          FROM json_each(t.toUserItems) AS toItem
          LEFT JOIN items i2 ON json_extract(toItem.value, '$.itemId') = i2.itemId 
            AND (i2.deleted IS NULL OR i2.deleted = 0)
          WHERE json_extract(toItem.value, '$.itemId') IS NOT NULL
        ) as toUserItems
      FROM trades t
      WHERE t.fromUserId = ? OR t.toUserId = ?
      ORDER BY t.createdAt DESC
    `;
        const results = await this.databaseService.read(query, [userId, userId]);
        return results.map((trade) => ({
            id: trade.id,
            fromUserId: trade.fromUserId,
            toUserId: trade.toUserId,
            fromUserItems: trade.fromUserItems,
            toUserItems: trade.toUserItems,
            approvedFromUser: !!trade.approvedFromUser,
            approvedToUser: !!trade.approvedToUser,
            status: trade.status,
            createdAt: trade.createdAt,
            updatedAt: trade.updatedAt
        }));
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
            // Pour les items sans métadonnées, vérifier avec le prix d'achat si spécifié
            if (tradeItem.purchasePrice) {
                const inventoryItems = await this.databaseService.read(`SELECT user_id, item_id, amount FROM inventories
           WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`, [userId, tradeItem.itemId, tradeItem.purchasePrice]);
                const totalAvailable = inventoryItems.reduce((sum, item) => sum + item.amount, 0);
                if (totalAvailable < tradeItem.amount) {
                    throw new Error("User does not have enough of the item with specified purchase price");
                }
            }
            else {
                // Vérification normale sans prix spécifique
                const hasItem = await this.inventoryService.hasItemWithoutMetadata(userId, tradeItem.itemId, tradeItem.amount);
                if (!hasItem)
                    throw new Error("User does not have enough of the item");
            }
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
            // Pour les items sans métadonnées, vérifier l'empilage avec le prix d'achat
            const idx = items.findIndex((i) => i.itemId === tradeItem.itemId &&
                !i.metadata?._unique_id &&
                i.purchasePrice === tradeItem.purchasePrice);
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
        await this.databaseService.request(`UPDATE trades SET ${userKey} = ?, approvedFromUser = 0, approvedToUser = 0, updatedAt = ? WHERE id = ?`, [JSON.stringify(items), trade.updatedAt, tradeId]);
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
            // Pour les items sans métadonnées, chercher avec le prix d'achat
            idx = items.findIndex((i) => i.itemId === tradeItem.itemId &&
                !i.metadata?._unique_id &&
                i.purchasePrice === tradeItem.purchasePrice);
        }
        if (idx === -1)
            return;
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
        await this.databaseService.request(`UPDATE trades SET ${userKey} = ?, approvedFromUser = 0, approvedToUser = 0, updatedAt = ? WHERE id = ?`, [JSON.stringify(items), trade.updatedAt, tradeId]);
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
        await this.databaseService.request(`UPDATE trades SET ${updateField} = 1, updatedAt = ? WHERE id = ?`, [updatedAt, tradeId]);
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
        await this.databaseService.request(`UPDATE trades SET status = ?, updatedAt = ? WHERE id = ?`, [trade.status, trade.updatedAt, tradeId]);
    }
    // Échange les items et passe la trade à completed
    async exchangeTradeItems(trade) {
        for (const item of trade.fromUserItems) {
            if (item.metadata?._unique_id) {
                await this.inventoryService.transferItem(trade.fromUserId, trade.toUserId, item.itemId, item.metadata._unique_id);
            }
            else {
                // Pour les items sans métadonnées, utiliser le prix d'achat spécifique si fourni
                if (item.purchasePrice !== undefined) {
                    await this.inventoryService.removeSellableItemWithPrice(trade.fromUserId, item.itemId, item.amount, item.purchasePrice);
                    await this.inventoryService.addItem(trade.toUserId, item.itemId, item.amount, undefined, true, // Les items échangés restent sellable
                    item.purchasePrice);
                }
                else {
                    // Méthode normale pour les items sans prix spécifique
                    const inventory = await this.inventoryService.getInventory(trade.fromUserId);
                    const inventoryItem = inventory.inventory.find(invItem => invItem.item_id === item.itemId && !invItem.metadata);
                    const isSellable = inventoryItem?.sellable || false;
                    const purchasePrice = inventoryItem?.purchasePrice;
                    await this.inventoryService.removeItem(trade.fromUserId, item.itemId, item.amount);
                    await this.inventoryService.addItem(trade.toUserId, item.itemId, item.amount, undefined, isSellable, purchasePrice);
                }
            }
        }
        for (const item of trade.toUserItems) {
            if (item.metadata?._unique_id) {
                await this.inventoryService.transferItem(trade.toUserId, trade.fromUserId, item.itemId, item.metadata._unique_id);
            }
            else {
                // Pour les items sans métadonnées, utiliser le prix d'achat spécifique si fourni
                if (item.purchasePrice !== undefined) {
                    await this.inventoryService.removeSellableItemWithPrice(trade.toUserId, item.itemId, item.amount, item.purchasePrice);
                    await this.inventoryService.addItem(trade.fromUserId, item.itemId, item.amount, undefined, true, // Les items échangés restent sellable
                    item.purchasePrice);
                }
                else {
                    // Méthode normale pour les items sans prix spécifique
                    const inventory = await this.inventoryService.getInventory(trade.toUserId);
                    const inventoryItem = inventory.inventory.find(invItem => invItem.item_id === item.itemId && !invItem.metadata);
                    const isSellable = inventoryItem?.sellable || false;
                    const purchasePrice = inventoryItem?.purchasePrice;
                    await this.inventoryService.removeItem(trade.toUserId, item.itemId, item.amount);
                    await this.inventoryService.addItem(trade.fromUserId, item.itemId, item.amount, undefined, isSellable, purchasePrice);
                }
            }
        }
        // Met à jour la trade
        const now = new Date().toISOString();
        await this.databaseService.request(`UPDATE trades SET status = 'completed', updatedAt = ? WHERE id = ?`, [now, trade.id]);
    }
};
exports.TradeService = TradeService;
exports.TradeService = TradeService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __param(1, (0, inversify_1.inject)("InventoryService")),
    __metadata("design:paramtypes", [Object, Object])
], TradeService);
