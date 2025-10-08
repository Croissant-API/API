import { InventoryItem } from 'interfaces/Inventory';
import { Item } from 'interfaces/Item';
import { inject, injectable } from 'inversify';
import { v4 } from 'uuid';
import { Trade, TradeItem } from '../interfaces/Trade';
import { TradeRepository } from '../repositories/TradeRepository';
import { IDatabaseService } from './DatabaseService';
import { IInventoryService } from './InventoryService';

export interface ITradeService {
  startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
  getTradeById(id: string): Promise<Trade | null>;
  getFormattedTradeById(id: string): Promise<Trade | null>;
  getTradesByUser(userId: string): Promise<Trade[]>;
  getFormattedTradesByUser(userId: string): Promise<Trade[]>;
  addItemToTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
  removeItemFromTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void>;
  approveTrade(tradeId: string, userId: string): Promise<void>;
  cancelTrade(tradeId: string, userId: string): Promise<void>;
}

@injectable()
export class TradeService implements ITradeService {
  private tradeRepository: TradeRepository;
  constructor(
    @inject('DatabaseService') private databaseService: IDatabaseService,
    @inject('InventoryService') private inventoryService: IInventoryService
  ) {
    this.tradeRepository = new TradeRepository(this.databaseService);
  }

  async startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade> {
    const existingTrade = await this.tradeRepository.findPendingTrade(fromUserId, toUserId);
    if (existingTrade) return this.parseTradeItems(existingTrade);
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
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    await this.tradeRepository.createTrade(newTrade);
    return newTrade;
  }

  async getTradeById(id: string): Promise<Trade | null> {
    const trade = await this.tradeRepository.getTradeById(id);
    return trade ? this.parseTradeItems(trade) : null;
  }

  async getFormattedTradeById(id: string): Promise<Trade | null> {
    const trade = await this.getTradeById(id);
    if (!trade) return null;
    const allItems = [...trade.fromUserItems, ...trade.toUserItems];
    const uniqueItemIds = Array.from(new Set(allItems.map(i => i.itemId)));
    let itemsInfo: Record<string, Item> = {};
    if (uniqueItemIds.length) {
      const placeholders = uniqueItemIds.map(() => '?').join(',');
      const items = await this.databaseService.read<Item>(`SELECT * FROM items WHERE itemId IN (${placeholders}) AND (deleted IS NULL OR deleted = 0)`, uniqueItemIds);
      itemsInfo = Object.fromEntries(items.map(item => [item.itemId, item]));
    }
    const enrich = (arr: TradeItem[]) => arr.map(item => ({ ...item, ...(itemsInfo[item.itemId] || {}) }));
    return {
      ...trade,
      fromUserItems: enrich(trade.fromUserItems),
      toUserItems: enrich(trade.toUserItems),
    };
  }

  async getTradesByUser(userId: string): Promise<Trade[]> {
    const trades = await this.tradeRepository.getTradesByUser(userId);
    return trades.map(t => this.parseTradeItems(t));
  }

  async getFormattedTradesByUser(userId: string): Promise<Trade[]> {
    const trades = await this.getTradesByUser(userId);
    if (!trades.length) return [];
    const allItemIds = Array.from(new Set(trades.flatMap(trade => [...trade.fromUserItems.map(i => i.itemId), ...trade.toUserItems.map(i => i.itemId)])));
    let itemsInfo: Record<string, Item> = {};
    if (allItemIds.length) {
      const placeholders = allItemIds.map(() => '?').join(',');
      const items = await this.databaseService.read<Item>(`SELECT * FROM items WHERE itemId IN (${placeholders}) AND (deleted IS NULL OR deleted = 0)`, allItemIds);
      itemsInfo = Object.fromEntries(items.map(item => [item.itemId, item]));
    }
    const enrich = (arr: TradeItem[]) => arr.map(item => ({ ...item, ...(itemsInfo[item.itemId] || {}) }));
    return trades.map(trade => ({
      ...trade,
      fromUserItems: enrich(trade.fromUserItems),
      toUserItems: enrich(trade.toUserItems),
    }));
  }

  private getUserKey(trade: Trade, userId: string): 'fromUserItems' | 'toUserItems' {
    if (trade.fromUserId === userId) return 'fromUserItems';
    if (trade.toUserId === userId) return 'toUserItems';
    throw new Error('User not part of this trade');
  }

  private assertPending(trade: Trade) {
    if (trade.status !== 'pending') throw new Error('Trade is not pending');
  }

  private parseTradeItems(trade: Trade): Trade {
    const parse = (items: unknown) => (typeof items === 'string' ? JSON.parse(items) : items);
    return {
      ...trade,
      fromUserItems: parse(trade.fromUserItems),
      toUserItems: parse(trade.toUserItems),
      approvedFromUser: !!trade.approvedFromUser,
      approvedToUser: !!trade.approvedToUser,
    };
  }

  async addItemToTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) throw new Error('Trade not found');
    this.assertPending(trade);
    const userKey = this.getUserKey(trade, userId);

    // Vérification de la possession de l'item
    if (tradeItem.metadata?._unique_id) {
      const inventoryItems = await this.databaseService.read<{ user_id: string; item_id: string; amount: number }>(
        `SELECT user_id, item_id, amount FROM inventories 
         WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
        [userId, tradeItem.itemId, tradeItem.metadata._unique_id]
      );
      if (!inventoryItems.length) throw new Error('User does not have this specific item');
    } else if (tradeItem.purchasePrice) {
      const inventoryItems = await this.databaseService.read<InventoryItem>(
        `SELECT user_id, item_id, amount FROM inventories
         WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`,
        [userId, tradeItem.itemId, tradeItem.purchasePrice]
      );
      const totalAvailable = inventoryItems.reduce((sum, item) => sum + item.amount, 0);
      if (totalAvailable < tradeItem.amount) throw new Error('User does not have enough of the item with specified purchase price');
    } else {
      const inventory = await this.inventoryService.getInventory(userId);
      const item = inventory.inventory.find(i => i.item_id === tradeItem.itemId);
      const hasItem = !!item && item.amount >= tradeItem.amount;
      if (!hasItem) throw new Error('User does not have enough of the item');
    }

    const items = [...trade[userKey]];
    if (tradeItem.metadata && tradeItem.metadata._unique_id) {
      if (items.find(i => i.itemId === tradeItem.itemId && i.metadata?._unique_id === tradeItem.metadata?._unique_id)) throw new Error('This specific item is already in the trade');
      items.push({ ...tradeItem });
    } else {
      const idx = items.findIndex(i => i.itemId === tradeItem.itemId && !i.metadata?._unique_id && i.purchasePrice === tradeItem.purchasePrice);
      if (idx >= 0) items[idx].amount += tradeItem.amount;
      else items.push({ ...tradeItem });
    }

    const now = new Date().toISOString();
    await this.tradeRepository.updateTradeFields(tradeId, {
      [userKey]: JSON.stringify(items),
      approvedFromUser: 0,
      approvedToUser: 0,
      updatedAt: now,
    });
  }

  async removeItemFromTrade(tradeId: string, userId: string, tradeItem: TradeItem): Promise<void> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) throw new Error('Trade not found');
    this.assertPending(trade);
    const userKey = this.getUserKey(trade, userId);
    const items = [...trade[userKey]];
    let idx = -1;
    if (tradeItem.metadata?._unique_id) {
      idx = items.findIndex(i => i.itemId === tradeItem.itemId && i.metadata?._unique_id === tradeItem.metadata?._unique_id);
    } else {
      idx = items.findIndex(i => i.itemId === tradeItem.itemId && !i.metadata?._unique_id && i.purchasePrice === tradeItem.purchasePrice);
    }
    if (idx === -1) return;
    if (tradeItem.metadata?._unique_id) {
      items.splice(idx, 1);
    } else {
      if (items[idx].amount < tradeItem.amount) throw new Error('Not enough amount to remove');
      items[idx].amount -= tradeItem.amount;
      if (items[idx].amount <= 0) items.splice(idx, 1);
    }
    const now = new Date().toISOString();
    await this.tradeRepository.updateTradeFields(tradeId, {
      [userKey]: JSON.stringify(items),
      approvedFromUser: 0,
      approvedToUser: 0,
      updatedAt: now,
    });
  }

  async approveTrade(tradeId: string, userId: string): Promise<void> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) throw new Error('Trade not found');
    this.assertPending(trade);
    const updateField = trade.fromUserId === userId ? 'approvedFromUser' : trade.toUserId === userId ? 'approvedToUser' : null;
    if (!updateField) throw new Error('User not part of this trade');
    const updatedAt = new Date().toISOString();
    await this.tradeRepository.updateTradeField(tradeId, updateField, 1, updatedAt);
    const updatedTrade = await this.getTradeById(tradeId);
    if (!updatedTrade) throw new Error('Trade not found after update');
    if (updatedTrade.approvedFromUser && updatedTrade.approvedToUser) {
      await this.exchangeTradeItems(updatedTrade);
    }
  }

  async cancelTrade(tradeId: string, userId: string): Promise<void> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) throw new Error('Trade not found');
    this.assertPending(trade);
    if (trade.fromUserId !== userId && trade.toUserId !== userId) {
      throw new Error('User not part of this trade');
    }
    const now = new Date().toISOString();
    await this.tradeRepository.updateTradeFields(tradeId, {
      status: 'canceled',
      updatedAt: now,
    });
  }

  // Échange les items et passe la trade à completed
  private async exchangeTradeItems(trade: Trade): Promise<void> {
    for (const item of trade.fromUserItems) {
      if (item.metadata?._unique_id) {
        await this.inventoryService.transferItem(trade.fromUserId, trade.toUserId, item.itemId, item.metadata._unique_id as string);
      } else if (item.purchasePrice !== undefined) {
        await this.inventoryService.getInventoryRepository().removeSellableItemWithPrice(trade.fromUserId, item.itemId, item.amount, item.purchasePrice);
        await this.inventoryService.addItem(trade.toUserId, item.itemId, item.amount, undefined, true, item.purchasePrice);
      } else {
        const inventory = await this.inventoryService.getInventory(trade.fromUserId);
        const inventoryItem = inventory.inventory.find(invItem => invItem.item_id === item.itemId && !invItem.metadata);
        const isSellable = inventoryItem?.sellable || false;
        const purchasePrice = inventoryItem?.purchasePrice;
        await this.inventoryService.removeItem(trade.fromUserId, item.itemId, item.amount);
        await this.inventoryService.addItem(trade.toUserId, item.itemId, item.amount, undefined, isSellable, purchasePrice);
      }
    }
    for (const item of trade.toUserItems) {
      if (item.metadata?._unique_id) {
        await this.inventoryService.transferItem(trade.toUserId, trade.fromUserId, item.itemId, item.metadata._unique_id as string);
      } else if (item.purchasePrice !== undefined) {
        await this.inventoryService.getInventoryRepository().removeSellableItemWithPrice(trade.toUserId, item.itemId, item.amount, item.purchasePrice);
        await this.inventoryService.addItem(trade.fromUserId, item.itemId, item.amount, undefined, true, item.purchasePrice);
      } else {
        const inventory = await this.inventoryService.getInventory(trade.toUserId);
        const inventoryItem = inventory.inventory.find(invItem => invItem.item_id === item.itemId && !invItem.metadata);
        const isSellable = inventoryItem?.sellable || false;
        const purchasePrice = inventoryItem?.purchasePrice;
        await this.inventoryService.removeItem(trade.toUserId, item.itemId, item.amount);
        await this.inventoryService.addItem(trade.fromUserId, item.itemId, item.amount, undefined, isSellable, purchasePrice);
      }
    }
    const now = new Date().toISOString();
    await this.tradeRepository.updateTradeFields(trade.id, {
      status: 'completed',
      updatedAt: now,
    });
  }
}
