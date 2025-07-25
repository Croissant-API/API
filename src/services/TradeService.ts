/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Trade, TradeItem } from "../interfaces/Trade";
import { v4 } from "uuid";
import { IInventoryService } from "./InventoryService";
import { IItemService } from "./ItemService";

export interface ITradeService {
  startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
  getTradeById(id: string): Promise<Trade | null>;
  getTradesByUser(userId: string): Promise<Trade[]>;
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
    @inject("InventoryService") private inventoryService: IInventoryService,
    @inject("ItemService") private itemService: IItemService // <-- à injecter
  ) {}

  async startOrGetPendingTrade(
    fromUserId: string,
    toUserId: string
  ): Promise<Trade> {
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

  private async enrichTradeItems(trade: Trade): Promise<Trade> {
    // Remplace chaque itemId par l'objet complet
    const enrich = async (tradeItems: TradeItem[]) => {
      return Promise.all(
        tradeItems.map(async (ti) => {
          const item = await this.itemService.getItem(ti.itemId);
          if (!item || !item.itemId) {
            throw new Error("Item not found or missing itemId");
          }
          return { ...item, itemId: item.itemId as string, amount: ti.amount };
        })
      ) as Promise<TradeItem[]>;
    };
    return {
      ...trade,
      fromUserItems: await enrich(trade.fromUserItems),
      toUserItems: await enrich(trade.toUserItems),
    };
  }

  async getTradeById(id: string): Promise<Trade | null> {
    const trades = await this.databaseService.read<any[]>(
      "SELECT * FROM trades WHERE id = ?",
      [id]
    );
    if (trades.length === 0) return null;
    const trade = this.deserializeTrade(trades[0]);
    return await this.enrichTradeItems(trade);
  }

  async getTradesByUser(userId: string): Promise<Trade[]> {
    const trades = await this.databaseService.read<any[]>(
      "SELECT * FROM trades WHERE fromUserId = ? OR toUserId = ? ORDER BY createdAt DESC",
      [userId, userId]
    );
    const deserialized = trades.map(this.deserializeTrade);
    return Promise.all(deserialized.map((t: Trade) => this.enrichTradeItems(t)));
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
    const hasItem = await this.inventoryService.hasItem(userId, tradeItem.itemId, tradeItem.amount);
    if (!hasItem) throw new Error("User does not have enough of the item");
    const items = [...trade[userKey]];
    const idx = items.findIndex((i) => i.itemId === tradeItem.itemId);
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
    const idx = items.findIndex((i) => i.itemId === tradeItem.itemId);
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
    this.assertPending(trade);
    const updateField = trade.fromUserId === userId ? "approvedFromUser" : trade.toUserId === userId ? "approvedToUser" : null;
    if (!updateField) throw new Error("User not part of this trade");
    trade[updateField] = true;
    trade.updatedAt = new Date().toISOString();
    await this.databaseService.update(
      `UPDATE trades SET ${updateField} = 1, updatedAt = ? WHERE id = ?`,
      [trade.updatedAt, tradeId]
    );
    if (trade.approvedFromUser && trade.approvedToUser) {
      await this.exchangeTradeItems(trade);
    }
  }

  async cancelTrade(tradeId: string, userId: string): Promise<void> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) throw new Error("Trade not found");
    this.assertPending(trade);
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
      await this.inventoryService.removeItem(
        trade.fromUserId,
        item.itemId,
        item.amount
      );
    }
    for (const item of trade.toUserItems) {
      await this.inventoryService.removeItem(
        trade.toUserId,
        item.itemId,
        item.amount
      );
    }
    // Ajoute les items à l'autre user
    for (const item of trade.fromUserItems) {
      await this.inventoryService.addItem(
        trade.toUserId,
        item.itemId,
        item.amount
      );
    }
    for (const item of trade.toUserItems) {
      await this.inventoryService.addItem(
        trade.fromUserId,
        item.itemId,
        item.amount
      );
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
