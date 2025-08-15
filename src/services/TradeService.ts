import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { TradeRepository } from "../repositories/TradeRepository";
import { Trade, TradeItem } from "../interfaces/Trade";
import { v4 } from "uuid";
import { IInventoryService } from "./InventoryService";
import { InventoryItem } from "interfaces/Inventory";
import { Item } from "interfaces/Item";

export interface ITradeService {
  startOrGetPendingTrade(fromUserId: string, toUserId: string): Promise<Trade>;
  getTradeById(id: string): Promise<Trade | null>;
  getFormattedTradeById(id: string): Promise<Trade | null>;
  getTradesByUser(userId: string): Promise<Trade[]>;
  getFormattedTradesByUser(userId: string): Promise<Trade[]>;
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
  private tradeRepository: TradeRepository;
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("InventoryService") private inventoryService: IInventoryService
  ) {
    this.tradeRepository = new TradeRepository(this.databaseService);
  }

  async startOrGetPendingTrade(
    fromUserId: string,
    toUserId: string
  ): Promise<Trade> {
    // Cherche une trade pending entre ces deux users (dans les deux sens)
    const existingTrade = await this.tradeRepository.findPendingTrade(fromUserId, toUserId);
    if (existingTrade) return existingTrade;
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
    await this.tradeRepository.createTrade(newTrade);
    return newTrade;
  }

  async getTradeById(id: string): Promise<Trade | null> {
    return await this.tradeRepository.getTradeById(id);
  }

  async getFormattedTradeById(id: string): Promise<Trade | null> {
    // 1. Récupère la trade brute
    const trades = await this.databaseService.read<Trade>(
      "SELECT * FROM trades WHERE id = ?",
      [id]
    );
    if (trades.length === 0) return null;
    const trade = trades[0];

    // 2. Parse les items JSON
    const fromUserItems: TradeItem[] =
      typeof trade.fromUserItems === "string"
        ? JSON.parse(trade.fromUserItems)
        : trade.fromUserItems;
    const toUserItems: TradeItem[] =
      typeof trade.toUserItems === "string"
        ? JSON.parse(trade.toUserItems)
        : trade.toUserItems;

    // 3. (Optionnel) Récupère les infos des items pour enrichir
    const allItemIds = [
      ...fromUserItems.map((i) => i.itemId),
      ...toUserItems.map((i) => i.itemId),
    ];
    const uniqueItemIds = Array.from(new Set(allItemIds));
    let itemsInfo: Record<string, Item> = {};
    if (uniqueItemIds.length > 0) {
      const placeholders = uniqueItemIds.map(() => "?").join(",");
      const items = await this.databaseService.read<Item>(
        `SELECT * FROM items WHERE itemId IN (${placeholders}) AND (deleted IS NULL OR deleted = 0)`,
        uniqueItemIds
      );
      itemsInfo = Object.fromEntries(
        items.map((item: Item) => [item.itemId, item])
      );
    }

    // 4. Enrichit les items avec les infos de la table items
    const enrich = (arr: TradeItem[]) =>
      arr.map((item) => ({
        ...item,
        ...(itemsInfo[item.itemId] || {}),
      }));

    return {
      id: trade.id,
      fromUserId: trade.fromUserId,
      toUserId: trade.toUserId,
      fromUserItems: enrich(fromUserItems),
      toUserItems: enrich(toUserItems),
      approvedFromUser: !!trade.approvedFromUser,
      approvedToUser: !!trade.approvedToUser,
      status: trade.status,
      createdAt: trade.createdAt,
      updatedAt: trade.updatedAt,
    };
  }

  async getTradesByUser(userId: string): Promise<Trade[]> {
    return await this.tradeRepository.getTradesByUser(userId);
  }

  async getFormattedTradesByUser(userId: string): Promise<Trade[]> {
    // On récupère les trades avec les items JSON bruts
    const trades = await this.databaseService.read<Trade>(
      "SELECT * FROM trades WHERE fromUserId = ? OR toUserId = ? ORDER BY createdAt DESC",
      [userId, userId]
    );

    // On parse les items JSON côté application
    return trades.map((trade) => ({
      ...trade,
      fromUserItems:
        typeof trade.fromUserItems === "string"
          ? JSON.parse(trade.fromUserItems)
          : trade.fromUserItems,
      toUserItems:
        typeof trade.toUserItems === "string"
          ? JSON.parse(trade.toUserItems)
          : trade.toUserItems,
      approvedFromUser: !!trade.approvedFromUser,
      approvedToUser: !!trade.approvedToUser,
    }));
  }

  private getUserKey(
    trade: Trade,
    userId: string
  ): "fromUserItems" | "toUserItems" {
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
      const inventoryItems = await this.databaseService.read<
        Array<{
          user_id: string;
          item_id: string;
          amount: number;
        }>
      >(
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
        const inventoryItems = await this.databaseService.read<InventoryItem>(
          `SELECT user_id, item_id, amount FROM inventories
           WHERE user_id = ? AND item_id = ? AND purchasePrice = ?`,
          [userId, tradeItem.itemId, tradeItem.purchasePrice]
        );

        const totalAvailable = inventoryItems.reduce(
          (sum: number, item: { amount: number }) => sum + item.amount,
          0
        );
        if (totalAvailable < tradeItem.amount) {
          throw new Error(
            "User does not have enough of the item with specified purchase price"
          );
        }
      } else {
        // Vérification normale sans prix spécifique
        const hasItem = await this.inventoryService.hasItemWithoutMetadata(
          userId,
          tradeItem.itemId,
          tradeItem.amount
        );
        if (!hasItem) throw new Error("User does not have enough of the item");
      }
    }

    const items = [...trade[userKey]];

    // Pour les items avec _unique_id, ne pas les empiler
    if (tradeItem.metadata?._unique_id) {
      // Vérifier que cet item unique n'est pas déjà dans le trade
      const existingItem = items.find(
        (i) =>
          i.itemId === tradeItem.itemId &&
          i.metadata?._unique_id === tradeItem.metadata?._unique_id
      );
      if (existingItem) {
        throw new Error("This specific item is already in the trade");
      }
      items.push({ ...tradeItem });
    } else {
      // Pour les items sans métadonnées, vérifier l'empilage avec le prix d'achat
      const idx = items.findIndex(
        (i) =>
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

    await this.tradeRepository.updateTradeFields(tradeId, {
      [userKey]: JSON.stringify(items),
      approvedFromUser: 0,
      approvedToUser: 0,
      updatedAt: trade.updatedAt
    });
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
      idx = items.findIndex(
        (i) =>
          i.itemId === tradeItem.itemId &&
          i.metadata?._unique_id === tradeItem.metadata?._unique_id
      );
    } else {
      // Pour les items sans métadonnées, chercher avec le prix d'achat
      idx = items.findIndex(
        (i) =>
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

    await this.tradeRepository.updateTradeFields(tradeId, {
      [userKey]: JSON.stringify(items),
      approvedFromUser: 0,
      approvedToUser: 0,
      updatedAt: trade.updatedAt
    });
  }

  async approveTrade(tradeId: string, userId: string): Promise<void> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) throw new Error("Trade not found");
    this.assertPending(trade);

    const updateField =
      trade.fromUserId === userId
        ? "approvedFromUser"
        : trade.toUserId === userId
          ? "approvedToUser"
          : null;
    if (!updateField) throw new Error("User not part of this trade");

    const updatedAt = new Date().toISOString();

  await this.tradeRepository.updateTradeField(tradeId, updateField, 1, updatedAt);

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

    await this.tradeRepository.updateTradeFields(tradeId, {
      status: trade.status,
      updatedAt: trade.updatedAt
    });
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
          const inventory = await this.inventoryService.getInventory(
            trade.fromUserId
          );
          const inventoryItem = inventory.inventory.find(
            (invItem) => invItem.item_id === item.itemId && !invItem.metadata
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
          const inventory = await this.inventoryService.getInventory(
            trade.toUserId
          );
          const inventoryItem = inventory.inventory.find(
            (invItem) => invItem.item_id === item.itemId && !invItem.metadata
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
    await this.tradeRepository.updateTradeFields(trade.id, {
      status: 'completed',
      updatedAt: now
    });
  }
}
