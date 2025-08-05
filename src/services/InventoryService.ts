import { inject, injectable } from "inversify";
import { IDatabaseConnection, IDatabaseService } from "./DatabaseService";
import { Inventory, InventoryItem } from "../interfaces/Inventory";
import { IUserService } from "./UserService";
import { v4 as uuidv4 } from "uuid";

export interface IInventoryService {
  getInventory(userId: string): Promise<Inventory>;
  getItemAmount(userId: string, itemId: string): Promise<number>;
  addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }, sellable?: boolean, purchasePrice?: number): Promise<void>;
  removeItem(userId: string, itemId: string, amount: number): Promise<void>;
  removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
  setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
  updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: { [key: string]: unknown }): Promise<void>;
  hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
  hasItemWithoutMetadata(userId: string, itemId: string, amount?: number): Promise<boolean>;
  transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void>;
  hasItemWithoutMetadataSellable(userId: string, itemId: string, amount?: number): Promise<boolean>;
  removeSellableItem(userId: string, itemId: string, amount: number): Promise<void>;
  removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number): Promise<void>;
}

@injectable()
export class InventoryService implements IInventoryService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("UserService") private userService: IUserService
  ) { }

  private async getCorrectedUserId(userId: string): Promise<string> {
    const user = await this.userService.getUser(userId);
    return user?.user_id || userId;
  }

  async getInventory(userId: string): Promise<Inventory> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      const correctedUserId = await this.getCorrectedUserId(userId);

      // Supprimer automatiquement les items non-existants ou supprimés
      await connection.request(
        `DELETE FROM inventories 
         WHERE user_id = ? 
         AND item_id NOT IN (
           SELECT itemId FROM items WHERE deleted IS NULL OR deleted = 0
         )`,
        [correctedUserId]
      );

      // Récupérer les items avec toutes leurs données en une seule requête
      const items = await connection.read<InventoryItem>(
        `SELECT 
           inv.user_id, 
           inv.item_id, 
           inv.amount, 
           inv.metadata,
           inv.sellable,
           inv.purchasePrice,
           i.itemId,
           i.name,
           i.description,
           i.iconHash,
           i.price,
           i.owner,
           i.showInStore
         FROM inventories inv
         INNER JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
         WHERE inv.user_id = ? AND inv.amount > 0`,
        [correctedUserId]
      );

      items.sort((a: InventoryItem, b: InventoryItem) => {
        const nameCompare = a.name?.localeCompare(b.name || '') || 0;
        if (nameCompare !== 0) return nameCompare;
        // Si même nom, trier par présence de métadonnées (sans métadonnées en premier)
        if (!a.metadata && b.metadata) return -1;
        if (a.metadata && !b.metadata) return 1;
        return 0;
      });

      const processedItems: InventoryItem[] = items.map((item) => ({
        user_id: item.user_id,
        item_id: item.item_id,
        amount: item.amount,
        metadata: item.metadata,
        sellable: !!item.sellable,
        purchasePrice: item.purchasePrice,
        // Données de l'item
        name: item.name,
        description: item.description,
        iconHash: item.iconHash,
        price: item.purchasePrice
      }));

      return { user_id: userId, inventory: processedItems };
    });
  }

  async getItemAmount(userId: string, itemId: string): Promise<number> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const items = await this.databaseService.read<InventoryItem>(
      "SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ?",
      [correctedUserId, itemId]
    );
    return items.length === 0 || !items[0].amount ? 0 : items[0].amount;
  }

  async addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }, sellable: boolean = false, purchasePrice?: number): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      const correctedUserId = await this.getCorrectedUserId(userId);

      if (metadata) {
        // Items avec métadonnées : créer des entrées uniques pour chaque quantité
        const metadataWithUniqueId = { ...metadata, _unique_id: uuidv4() };

        for (let i = 0; i < amount; i++) {
          const uniqueMetadata = { ...metadataWithUniqueId, _unique_id: uuidv4() };
          await connection.request(
            "INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
            [correctedUserId, itemId, 1, JSON.stringify(uniqueMetadata), sellable ? 1 : 0, purchasePrice]
          );
        }
      } else {
        // Items sans métadonnées : peuvent s'empiler seulement s'ils ont le même état sellable ET le même prix d'achat
        const items = await connection.read<InventoryItem[]>(
          "SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND (purchasePrice = ? OR (purchasePrice IS NULL AND ? IS NULL)) FOR UPDATE",
          [correctedUserId, itemId, sellable ? 1 : 0, purchasePrice, purchasePrice]
        );

        if (items.length > 0) {
          await connection.request(
            "UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND (purchasePrice = ? OR (purchasePrice IS NULL AND ? IS NULL))",
            [amount, correctedUserId, itemId, sellable ? 1 : 0, purchasePrice, purchasePrice]
          );
        } else {
          await connection.request(
            "INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
            [correctedUserId, itemId, amount, null, sellable ? 1 : 0, purchasePrice]
          );
        }
      }
    });
  }

  async setItemAmount(userId: string, itemId: string, amount: number): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      const correctedUserId = await this.getCorrectedUserId(userId);

      if (amount <= 0) {
        await connection.request(
          `DELETE FROM inventories WHERE user_id = ? AND item_id = ?`,
          [correctedUserId, itemId]
        );
        return;
      }

      // Items sans métadonnées seulement - par défaut sellable = false, pas de prix d'achat
      const items = await connection.read<InventoryItem[]>(
        "SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL FOR UPDATE",
        [correctedUserId, itemId]
      );

      if (items.length > 0) {
        await connection.request(
          `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL`,
          [amount, correctedUserId, itemId]
        );
      } else {
        await connection.request(
          `INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)`,
          [correctedUserId, itemId, amount, null, 0, null]
        );
      }
    });
  }

  async updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: { [key: string]: unknown }): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      const correctedUserId = await this.getCorrectedUserId(userId);
      const metadataWithUniqueId = { ...metadata, _unique_id: uniqueId };
      const metadataJson = JSON.stringify(metadataWithUniqueId);

      // Vérifier que l'item existe avant de le modifier
      const existingItems = await connection.read<InventoryItem>(
        "SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ? FOR UPDATE",
        [correctedUserId, itemId, uniqueId]
      );

      if (existingItems.length === 0) {
        throw new Error("Item not found in inventory");
      }

      await connection.request(
        "UPDATE inventories SET metadata = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?",
        [metadataJson, correctedUserId, itemId, uniqueId]
      );
    });
  }

  async removeItem(userId: string, itemId: string, amount: number): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      const correctedUserId = await this.getCorrectedUserId(userId);

      // Ne supprimer que les items SANS métadonnées avec verrouillage
      const items = await connection.read<InventoryItem>(
        `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL ORDER BY amount DESC FOR UPDATE`,
        [correctedUserId, itemId]
      );

      if (items.length === 0) {
        throw new Error("No items found to remove");
      }

      let remainingToRemove = amount;
      const totalAvailable = items.reduce((sum, item) => sum + item.amount, 0);

      if (totalAvailable < amount) {
        throw new Error("Insufficient items to remove");
      }

      for (const item of items) {
        if (remainingToRemove <= 0) break;

        // Items sans métadonnées : peuvent être réduits
        const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
        const newAmount = item.amount - toRemoveFromStack;

        if (newAmount <= 0) {
          await connection.request(
            `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND amount = ?`,
            [correctedUserId, itemId, item.sellable ? 1 : 0, item.amount]
          );
        } else {
          await connection.request(
            `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND amount = ?`,
            [newAmount, correctedUserId, itemId, item.sellable ? 1 : 0, item.amount]
          );
        }
        remainingToRemove -= toRemoveFromStack;
      }
    });
  }

  async removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      const correctedUserId = await this.getCorrectedUserId(userId);

      // Vérifier que l'item existe avant de le supprimer
      const existingItems = await connection.read<InventoryItem>(
        `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ? FOR UPDATE`,
        [correctedUserId, itemId, uniqueId]
      );

      if (existingItems.length === 0) {
        throw new Error("Item not found in inventory");
      }

      await connection.request(
        `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
        [correctedUserId, itemId, uniqueId]
      );
    });
  }

  async hasItem(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const totalAmount = await this.getItemAmount(userId, itemId);
    return totalAmount >= amount;
  }

  async hasItemWithoutMetadata(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const items = await this.databaseService.read<{ total: number | null }>(
      "SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL",
      [correctedUserId, itemId]
    );
    const totalAmount = items.length === 0 || !items[0].total ? 0 : items[0].total;
    return totalAmount >= amount;
  }

  async hasItemWithoutMetadataSellable(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const items = await this.databaseService.read<{ total: number | null }>(
      "SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1",
      [correctedUserId, itemId]
    );
    const totalAmount = items.length === 0 || !items[0].total ? 0 : items[0].total;
    return totalAmount >= amount;
  }

  async removeSellableItem(userId: string, itemId: string, amount: number): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      const correctedUserId = await this.getCorrectedUserId(userId);

      const items = await connection.read<InventoryItem>(
        `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 ORDER BY amount DESC FOR UPDATE`,
        [correctedUserId, itemId]
      );

      if (items.length === 0) {
        throw new Error("No sellable items found");
      }

      let remainingToRemove = amount;
      const totalAvailable = items.reduce((sum, item) => sum + item.amount, 0);

      if (totalAvailable < amount) {
        throw new Error("Insufficient sellable items");
      }

      for (const item of items) {
        if (remainingToRemove <= 0) break;

        const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
        const newAmount = item.amount - toRemoveFromStack;

        if (newAmount <= 0) {
          await connection.request(
            `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND amount = ?`,
            [correctedUserId, itemId, item.amount]
          );
        } else {
          await connection.request(
            `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND amount = ?`,
            [newAmount, correctedUserId, itemId, item.amount]
          );
        }
        remainingToRemove -= toRemoveFromStack;
      }
    });
  }

  async removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      const correctedUserId = await this.getCorrectedUserId(userId);

      const items = await connection.read<InventoryItem>(
        `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND purchasePrice = ? ORDER BY amount DESC FOR UPDATE`,
        [correctedUserId, itemId, purchasePrice]
      );

      if (items.length === 0) {
        throw new Error("No sellable items found with specified price");
      }

      let remainingToRemove = amount;
      const totalAvailable = items.reduce((sum, item) => sum + item.amount, 0);

      if (totalAvailable < amount) {
        throw new Error("Insufficient sellable items with specified price");
      }

      for (const item of items) {
        if (remainingToRemove <= 0) break;

        const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
        const newAmount = item.amount - toRemoveFromStack;

        if (newAmount <= 0) {
          await connection.request(
            `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND purchasePrice = ? AND amount = ?`,
            [correctedUserId, itemId, purchasePrice, item.amount]
          );
        } else {
          await connection.request(
            `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND purchasePrice = ? AND amount = ?`,
            [newAmount, correctedUserId, itemId, purchasePrice, item.amount]
          );
        }
        remainingToRemove -= toRemoveFromStack;
      }
    });
  }

  async transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      const correctedFromUserId = await this.getCorrectedUserId(fromUserId);
      const correctedToUserId = await this.getCorrectedUserId(toUserId);

      // Vérifier que l'item existe dans l'inventaire du fromUser avec verrouillage
      const items = await connection.read<(InventoryItem & { metadata: string | null })[]>(
        `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ? FOR UPDATE`,
        [correctedFromUserId, itemId, uniqueId]
      );

      if (items.length === 0) {
        throw new Error("Item not found in user's inventory");
      }

      // Transférer la propriété en changeant seulement le user_id
      await connection.request(
        `UPDATE inventories SET user_id = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
        [correctedToUserId, correctedFromUserId, itemId, uniqueId]
      );
    });
  }
}
