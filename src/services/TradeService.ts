/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Trade, TradeItem } from "../interfaces/Trade";
import { v4 } from "uuid";
import { IInventoryService } from "./InventoryService";

export interface ITradeService {
  startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
  getTradeById(id: string): Promise<Trade | null>;
  getFormattedTradeById(id: string): Promise<{
    id: string;
    fromUserId: string;
    toUserId: string;
    fromUserItems: Array<{
      itemId: string;
      name: string;
      description: string;
      iconHash?: string;
      amount: number;
      uniqueId?: string;
      metadata?: { [key: string]: unknown };
      purchasePrice?: number; // Ajouter le purchasePrice
    }>;
    toUserItems: Array<{
      itemId: string;
      name: string;
      description: string;
      iconHash?: string;
      amount: number;
      uniqueId?: string;
      metadata?: { [key: string]: unknown };
      purchasePrice?: number; // Ajouter le purchasePrice
    }>;
    approvedFromUser: boolean;
    approvedToUser: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null>;
  getTradesByUser(userId: string): Promise<Trade[]>;
  getFormattedTradesByUser(userId: string): Promise<Array<{
    id: string;
    fromUserId: string;
    toUserId: string;
    fromUserItems: Array<{
      itemId: string;
      name: string;
      description: string;
      iconHash?: string;
      amount: number;
      uniqueId?: string;
      metadata?: { [key: string]: unknown };
      purchasePrice?: number; // Ajouter le purchasePrice
    }>;
    toUserItems: Array<{
      itemId: string;
      name: string;
      description: string;
      iconHash?: string;
      amount: number;
      uniqueId?: string;
      metadata?: { [key: string]: unknown };
      purchasePrice?: number; // Ajouter le purchasePrice
    }>;
    approvedFromUser: boolean;
    approvedToUser: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>>;
  addItemToTrade(
    tradeId: string,
    userId: string,
    tradeItem: TradeItem
  ): Promise<void>;
  removeItemFromTrade(
    tradeId: string,
    userId: string,
    tradeItem: TradeItem
  ): Promise<void>;
  approveTrade(tradeId: string, userId: string): Promise<void>;
  cancelTrade(tradeId: string, userId: string): Promise<void>;
}

@injectable()
export class TradeService implements ITradeService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("InventoryService") private inventoryService: IInventoryService
  ) {}

  async startOrGetPendingTrade(
    fromUserId: string,
    toUserId: string
  ): Promise<Trade> {
    // Cherche une trade pending entre ces deux users (dans les deux sens)
    const trades = await this.databaseService.read<any[]>(
      `SELECT * FROM trades 
       WHERE status = 'pending' 
         AND ((fromUserId = ? AND toUserId = ?) OR (fromUserId = ? AND toUserId = ?)) 
       ORDER BY createdAt DESC 
       LIMIT 1`,
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
      updatedAt: now,
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
        newTrade.updatedAt,
      ]
    );
    
    return newTrade;
  }

  private async enrichTradeItemsWithSQL(tradeItems: TradeItem[]): Promise<Array<{
    itemId: string;
    name: string;
    description: string;
    iconHash?: string;
    amount: number;
    uniqueId?: string;
    metadata?: { [key: string]: unknown };
    purchasePrice?: number; // Ajouter le purchasePrice
  }>> {
    if (!tradeItems.length) return [];
    
    const itemIds = [...new Set(tradeItems.map(ti => ti.itemId))]; // Remove duplicates
    if (!itemIds.length) return []; // Additional safety check
    
    const items = await this.databaseService.read<Array<{
      itemId: string;
      name: string;
      description: string;
      iconHash?: string;
    }>>(
      `SELECT itemId, name, description, iconHash 
       FROM items 
       WHERE itemId IN (${itemIds.map(() => "?").join(",")}) 
         AND (deleted IS NULL OR deleted = 0)`,
      itemIds
    );
    
    const enrichedItems = [];
    
    for (const ti of tradeItems) {
      const item = items.find((i: { itemId: string; }) => i.itemId === ti.itemId);
      if (!item) {
        throw new Error(`Item ${ti.itemId} not found or deleted`);
      }
      
      enrichedItems.push({
        itemId: item.itemId,
        name: item.name,
        description: item.description,
        iconHash: item.iconHash,
        amount: ti.amount,
        uniqueId: ti.metadata?._unique_id as string | undefined,
        metadata: ti.metadata,
        purchasePrice: ti.purchasePrice // Transmettre le purchasePrice
      });
    }
    
    return enrichedItems;
  }

  async getTradeById(id: string): Promise<Trade | null> {
    const trades = await this.databaseService.read<any[]>(
      "SELECT * FROM trades WHERE id = ?",
      [id]
    );
    if (trades.length === 0) return null;
    return this.deserializeTrade(trades[0]);
  }

  async getFormattedTradeById(id: string): Promise<{
    id: string;
    fromUserId: string;
    toUserId: string;
    fromUserItems: Array<{
      itemId: string;
      name: string;
      description: string;
      iconHash?: string;
      amount: number;
      uniqueId?: string;
      metadata?: { [key: string]: unknown };
      purchasePrice?: number; // Ajouter le purchasePrice
    }>;
    toUserItems: Array<{
      itemId: string;
      name: string;
      description: string;
      iconHash?: string;
      amount: number;
      uniqueId?: string;
      metadata?: { [key: string]: unknown };
      purchasePrice?: number; // Ajouter le purchasePrice
    }>;
    approvedFromUser: boolean;
    approvedToUser: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null> {
    const trade = await this.getTradeById(id);
    if (!trade) return null;
    
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

  async getTradesByUser(userId: string): Promise<Trade[]> {
    const trades = await this.databaseService.read<any[]>(
      "SELECT * FROM trades WHERE fromUserId = ? OR toUserId = ? ORDER BY createdAt DESC",
      [userId, userId]
    );
    return trades.map(this.deserializeTrade);
  }

  async getFormattedTradesByUser(userId: string): Promise<Array<{
    id: string;
    fromUserId: string;
    toUserId: string;
    fromUserItems: Array<{
      itemId: string;
      name: string;
      description: string;
      iconHash?: string;
      amount: number;
      uniqueId?: string;
      metadata?: { [key: string]: unknown };
      purchasePrice?: number; // Ajouter le purchasePrice
    }>;
    toUserItems: Array<{
      itemId: string;
      name: string;
      description: string;
      iconHash?: string;
      amount: number;
      uniqueId?: string;
      metadata?: { [key: string]: unknown };
      purchasePrice?: number; // Ajouter le purchasePrice
    }>;
    approvedFromUser: boolean;
    approvedToUser: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>> {
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

  private getUserKey(trade: Trade, userId: string): "fromUserItems" | "toUserItems" {
    if (trade.fromUserId === userId) return "fromUserItems";
    if (trade.toUserId === userId) return "toUserItems";
    throw new Error("User not part of this trade");
  }

  private assertPending(trade: Trade) {
    if (trade.status !== "pending") throw new Error("Trade is not pending");
  }

  async addItemToTrade(
    tradeId: string,
    userId: string,
    tradeItem: TradeItem
  ): Promise<void> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) throw new Error("Trade not found");
    this.assertPending(trade);
    
    const userKey = this.getUserKey(trade, userId);
    
    // Vérification différente selon si l'item a des métadonnées ou non
    if (tradeItem.metadata?._unique_id) {
      // Pour les items avec métadonnées, vérifier l'existence spécifique
      const inventoryItems = await this.databaseService.read<Array<{
        user_id: string;
        item_id: string;
        amount: number;
      }>>(
        `SELECT user_id, item_id, amount FROM inventories 
         WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
        [userId, tradeItem.itemId, tradeItem.metadata._unique_id]
      );
      
      if (inventoryItems.length === 0) {
        throw new Error("User does not have this specific item");
      }
    } else {
      // Pour les items sans métadonnées, vérifier avec le prix d'achat si spécifié
      if (tradeItem.purchasePrice) {
        const inventoryItems = await this.databaseService.read<Array<{
          user_id: string;
          item_id: string;
          amount: number;
        }>>(
          `SELECT user_id, item_id, amount FROM inventories
           WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`,
          [userId, tradeItem.itemId, tradeItem.purchasePrice]
        );
        
        const totalAvailable = inventoryItems.reduce((sum: any, item: { amount: any; }) => sum + item.amount, 0);
        if (totalAvailable < tradeItem.amount) {
          throw new Error("User does not have enough of the item with specified purchase price");
        }
      } else {
        // Vérification normale sans prix spécifique
        const hasItem = await this.inventoryService.hasItemWithoutMetadata(userId, tradeItem.itemId, tradeItem.amount);
        if (!hasItem) throw new Error("User does not have enough of the item");
      }
    }
    
    const items = [...trade[userKey]];
    
    // Pour les items avec _unique_id, ne pas les empiler
    if (tradeItem.metadata?._unique_id) {
      // Vérifier que cet item unique n'est pas déjà dans le trade
      const existingItem = items.find(i => 
        i.itemId === tradeItem.itemId && 
        i.metadata?._unique_id === tradeItem.metadata?._unique_id
      );
      if (existingItem) {
        throw new Error("This specific item is already in the trade");
      }
      items.push({ ...tradeItem });
    } else {
      // Pour les items sans métadonnées, vérifier l'empilage avec le prix d'achat
      const idx = items.findIndex((i) => 
        i.itemId === tradeItem.itemId && 
        !i.metadata?._unique_id &&
        i.purchasePrice === tradeItem.purchasePrice
      );
      if (idx >= 0) {
        items[idx].amount += tradeItem.amount;
      } else {
        items.push({ ...tradeItem });
      }
    }
    
    trade[userKey] = items;
    trade.updatedAt = new Date().toISOString();
    trade.approvedFromUser = false;
    trade.approvedToUser = false;
    
    await this.databaseService.update(
      `UPDATE trades SET ${userKey} = ?, approvedFromUser = 0, approvedToUser = 0, updatedAt = ? WHERE id = ?`,
      [JSON.stringify(items), trade.updatedAt, tradeId]
    );
  }

  async removeItemFromTrade(
    tradeId: string,
    userId: string,
    tradeItem: TradeItem
  ): Promise<void> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) throw new Error("Trade not found");
    this.assertPending(trade);
    
    const userKey = this.getUserKey(trade, userId);
    const items = [...trade[userKey]];
    
    let idx = -1;
    
    if (tradeItem.metadata?._unique_id) {
      // Pour les items avec _unique_id, chercher l'item spécifique
      idx = items.findIndex((i) => 
        i.itemId === tradeItem.itemId && 
        i.metadata?._unique_id === tradeItem.metadata?._unique_id
      );
    } else {
      // Pour les items sans métadonnées, chercher avec le prix d'achat
      idx = items.findIndex((i) => 
        i.itemId === tradeItem.itemId && 
        !i.metadata?._unique_id &&
        i.purchasePrice === tradeItem.purchasePrice
      );
    }
    
    if (idx === -1) return;
    
    if (tradeItem.metadata?._unique_id) {
      // Pour les items uniques, les supprimer complètement
      items.splice(idx, 1);
    } else {
      // Pour les items empilables, décrémenter la quantité
      if (items[idx].amount < tradeItem.amount) throw new Error("Not enough amount to remove");
      
      items[idx].amount -= tradeItem.amount;
      if (items[idx].amount <= 0) {
        items.splice(idx, 1);
      }
    }
    
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
    this.assertPending(trade);
    
    const updateField = trade.fromUserId === userId ? "approvedFromUser" : 
                      trade.toUserId === userId ? "approvedToUser" : null;
    if (!updateField) throw new Error("User not part of this trade");
    
    const updatedAt = new Date().toISOString();
    
    await this.databaseService.update(
      `UPDATE trades SET ${updateField} = 1, updatedAt = ? WHERE id = ?`,
      [updatedAt, tradeId]
    );
    
    // Récupère la trade mise à jour pour vérifier l'état actuel
    const updatedTrade = await this.getTradeById(tradeId);
    if (!updatedTrade) throw new Error("Trade not found after update");
    
    // Vérifie si les deux utilisateurs ont approuvé
    if (updatedTrade.approvedFromUser && updatedTrade.approvedToUser) {
      await this.exchangeTradeItems(updatedTrade);
    }
  }

  async cancelTrade(tradeId: string, userId: string): Promise<void> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) throw new Error("Trade not found");
    this.assertPending(trade);
    
    if (trade.fromUserId !== userId && trade.toUserId !== userId) {
      throw new Error("User not part of this trade");
    }
    
    trade.status = "canceled";
    trade.updatedAt = new Date().toISOString();
    
    await this.databaseService.update(
      `UPDATE trades SET status = ?, updatedAt = ? WHERE id = ?`,
      [trade.status, trade.updatedAt, tradeId]
    );
  }

  // Échange les items et passe la trade à completed
  private async exchangeTradeItems(trade: Trade): Promise<void> {
    for (const item of trade.fromUserItems) {
      if (item.metadata?._unique_id) {
        await this.inventoryService.transferItem(
          trade.fromUserId,
          trade.toUserId,
          item.itemId,
          item.metadata._unique_id as string
        );
      } else {
        // Pour les items sans métadonnées, utiliser le prix d'achat spécifique si fourni
        if (item.purchasePrice !== undefined) {
          await this.inventoryService.removeSellableItemWithPrice(
            trade.fromUserId,
            item.itemId,
            item.amount,
            item.purchasePrice
          );
          await this.inventoryService.addItem(
            trade.toUserId,
            item.itemId,
            item.amount,
            undefined,
            true, // Les items échangés restent sellable
            item.purchasePrice
          );
        } else {
          // Méthode normale pour les items sans prix spécifique
          const inventory = await this.inventoryService.getInventory(trade.fromUserId);
          const inventoryItem = inventory.inventory.find(
            invItem => invItem.item_id === item.itemId && !invItem.metadata
          );
          const isSellable = inventoryItem?.sellable || false;
          const purchasePrice = inventoryItem?.purchasePrice;
          
          await this.inventoryService.removeItem(
            trade.fromUserId,
            item.itemId,
            item.amount
          );
          await this.inventoryService.addItem(
            trade.toUserId,
            item.itemId,
            item.amount,
            undefined,
            isSellable,
            purchasePrice
          );
        }
      }
    }
    
    for (const item of trade.toUserItems) {
      if (item.metadata?._unique_id) {
        await this.inventoryService.transferItem(
          trade.toUserId,
          trade.fromUserId,
          item.itemId,
          item.metadata._unique_id as string
        );
      } else {
        // Pour les items sans métadonnées, utiliser le prix d'achat spécifique si fourni
        if (item.purchasePrice !== undefined) {
          await this.inventoryService.removeSellableItemWithPrice(
            trade.toUserId,
            item.itemId,
            item.amount,
            item.purchasePrice
          );
          await this.inventoryService.addItem(
            trade.fromUserId,
            item.itemId,
            item.amount,
            undefined,
            true, // Les items échangés restent sellable
            item.purchasePrice
          );
        } else {
          // Méthode normale pour les items sans prix spécifique
          const inventory = await this.inventoryService.getInventory(trade.toUserId);
          const inventoryItem = inventory.inventory.find(
            invItem => invItem.item_id === item.itemId && !invItem.metadata
          );
          const isSellable = inventoryItem?.sellable || false;
          const purchasePrice = inventoryItem?.purchasePrice;
          
          await this.inventoryService.removeItem(
            trade.toUserId,
            item.itemId,
            item.amount
          );
          await this.inventoryService.addItem(
            trade.fromUserId,
            item.itemId,
            item.amount,
            undefined,
            isSellable,
            purchasePrice
          );
        }
      }
    }
    
    // Met à jour la trade
    const now = new Date().toISOString();
    await this.databaseService.update(
      `UPDATE trades SET status = 'completed', updatedAt = ? WHERE id = ?`,
      [now, trade.id]
    );
  }

  private deserializeTrade = (row: any): Trade => ({
    ...row,
    fromUserItems: JSON.parse(row.fromUserItems),
    toUserItems: JSON.parse(row.toUserItems),
    approvedFromUser: !!row.approvedFromUser,
    approvedToUser: !!row.approvedToUser,
  });
}