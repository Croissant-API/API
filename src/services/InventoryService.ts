/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Inventory, InventoryItem } from "../interfaces/Inventory";
import { IUserService } from "./UserService";
import { v4 as uuidv4 } from "uuid";

export interface IInventoryService {
  getInventory(userId: string): Promise<Inventory>;
  getItemAmount(userId: string, itemId: string): Promise<number>;
  addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }, sellable?: boolean): Promise<void>;
  removeItem(userId: string, itemId: string, amount: number): Promise<void>;
  removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
  setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
  updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: { [key: string]: unknown }): Promise<void>;
  hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
  hasItemWithoutMetadata(userId: string, itemId: string, amount?: number): Promise<boolean>;
  transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void>;
  hasItemWithoutMetadataSellable(userId: string, itemId: string, amount?: number): Promise<boolean>;
  removeSellableItem(userId: string, itemId: string, amount: number): Promise<void>;
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

  private parseMetadata(metadataJson: string | null): { [key: string]: unknown } | undefined {
    if (!metadataJson) return undefined;
    try {
      return JSON.parse(metadataJson);
    } catch {
      return undefined;
    }
  }

  async getInventory(userId: string): Promise<Inventory> {
    const correctedUserId = await this.getCorrectedUserId(userId);

    // Supprimer automatiquement les items non-existants ou supprimés
    await this.databaseService.update(
      `DELETE FROM inventories 
       WHERE user_id = ? 
       AND item_id NOT IN (
         SELECT itemId FROM items WHERE deleted IS NULL OR deleted = 0
       )`,
      [correctedUserId]
    );

    // Récupérer les items avec toutes leurs données en une seule requête
    const items = await this.databaseService.read<any[]>(
      `SELECT 
         inv.user_id, 
         inv.item_id, 
         inv.amount, 
         inv.metadata,
         inv.sellable,
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

    items.sort((a: any, b: any) => {
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;
      // Si même nom, trier par présence de métadonnées (sans métadonnées en premier)
      if (!a.metadata && b.metadata) return -1;
      if (a.metadata && !b.metadata) return 1;
      return 0;
    });

    const processedItems: any[] = items.map((item: any) => ({
      user_id: item.user_id,
      item_id: item.item_id,
      amount: item.amount,
      metadata: this.parseMetadata(item.metadata ?? null),
      sellable: !!item.sellable,
      // Données de l'item
      itemId: item.itemId,
      name: item.name,
      description: item.description,
      iconHash: item.iconHash,
      price: item.price,
      owner: item.owner,
      showInStore: item.showInStore
    }));

    return { user_id: userId, inventory: processedItems };
  }

  async getItemAmount(userId: string, itemId: string): Promise<number> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const items = await this.databaseService.read<InventoryItem[]>(
      "SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ?",
      [correctedUserId, itemId]
    );
    return items.length === 0 || !items[0].amount ? 0 : items[0].amount;
  }

  async addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }, sellable: boolean = false): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);

    if (metadata) {
      // Items avec métadonnées : créer des entrées uniques pour chaque quantité
      const metadataWithUniqueId = { ...metadata, _unique_id: uuidv4() };

      for (let i = 0; i < amount; i++) {
        const uniqueMetadata = { ...metadataWithUniqueId, _unique_id: uuidv4() };
        await this.databaseService.update(
          "INSERT INTO inventories (user_id, item_id, amount, metadata, sellable) VALUES (?, ?, ?, ?, ?)",
          [correctedUserId, itemId, 1, JSON.stringify(uniqueMetadata), sellable ? 1 : 0]
        );
      }
    } else {
      // Items sans métadonnées : peuvent s'empiler seulement s'ils ont le même état sellable
      const items = await this.databaseService.read<InventoryItem[]>(
        "SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ?",
        [correctedUserId, itemId, sellable ? 1 : 0]
      );

      if (items.length > 0) {
        await this.databaseService.update(
          "UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ?",
          [amount, correctedUserId, itemId, sellable ? 1 : 0]
        );
      } else {
        await this.databaseService.update(
          "INSERT INTO inventories (user_id, item_id, amount, metadata, sellable) VALUES (?, ?, ?, ?, ?)",
          [correctedUserId, itemId, amount, null, sellable ? 1 : 0]
        );
      }
    }
  }

  async setItemAmount(userId: string, itemId: string, amount: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);

    if (amount <= 0) {
      await this.databaseService.update(
        `DELETE FROM inventories WHERE user_id = ? AND item_id = ?`,
        [correctedUserId, itemId]
      );
      return;
    }

    // Items sans métadonnées seulement - par défaut sellable = false
    const items = await this.databaseService.read<InventoryItem[]>(
      "SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL",
      [correctedUserId, itemId]
    );

    if (items.length > 0) {
      await this.databaseService.update(
        `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL`,
        [amount, correctedUserId, itemId]
      );
    } else {
      await this.databaseService.update(
        `INSERT INTO inventories (user_id, item_id, amount, metadata, sellable) VALUES (?, ?, ?, ?, ?)`,
        [correctedUserId, itemId, amount, null, 0]
      );
    }
  }

  async updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: { [key: string]: unknown }): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const metadataWithUniqueId = { ...metadata, _unique_id: uniqueId };
    const metadataJson = JSON.stringify(metadataWithUniqueId);

    await this.databaseService.update(
      "UPDATE inventories SET metadata = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?",
      [metadataJson, correctedUserId, itemId, uniqueId]
    );
  }

  async removeItem(userId: string, itemId: string, amount: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);

    // Ne supprimer que les items SANS métadonnées
    const items = await this.databaseService.read<(InventoryItem & { metadata: string | null; sellable: boolean })[]>(
      `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL ORDER BY amount DESC`,
      [correctedUserId, itemId]
    );

    let remainingToRemove = amount;

    for (const item of items) {
      if (remainingToRemove <= 0) break;

      // Items sans métadonnées : peuvent être réduits
      const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
      const newAmount = item.amount - toRemoveFromStack;

      if (newAmount <= 0) {
        await this.databaseService.update(
          `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ?`,
          [correctedUserId, itemId, item.sellable ? 1 : 0]
        );
      } else {
        await this.databaseService.update(
          `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ?`,
          [newAmount, correctedUserId, itemId, item.sellable ? 1 : 0]
        );
      }
      remainingToRemove -= toRemoveFromStack;
    }
  }

  async removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);

    await this.databaseService.update(
      `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
      [correctedUserId, itemId, uniqueId]
    );
  }

  async hasItem(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const totalAmount = await this.getItemAmount(userId, itemId);
    return totalAmount >= amount;
  }

  async hasItemWithoutMetadata(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const items = await this.databaseService.read<{ total: number | null }[]>(
      "SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL",
      [correctedUserId, itemId]
    );
    const totalAmount = items.length === 0 || !items[0].total ? 0 : items[0].total;
    return totalAmount >= amount;
  }

  // Nouvelle méthode pour vérifier les items sellable
  async hasItemWithoutMetadataSellable(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const items = await this.databaseService.read<{ total: number | null }[]>(
      "SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1",
      [correctedUserId, itemId]
    );
    const totalAmount = items.length === 0 || !items[0].total ? 0 : items[0].total;
    return totalAmount >= amount;
  }

  // Nouvelle méthode pour supprimer spécifiquement les items sellable
  async removeSellableItem(userId: string, itemId: string, amount: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);

    const items = await this.databaseService.read<(InventoryItem & { metadata: string | null; sellable: boolean })[]>(
      `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 ORDER BY amount DESC`,
      [correctedUserId, itemId]
    );

    let remainingToRemove = amount;

    for (const item of items) {
      if (remainingToRemove <= 0) break;

      const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
      const newAmount = item.amount - toRemoveFromStack;

      if (newAmount <= 0) {
        await this.databaseService.update(
          `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1`,
          [correctedUserId, itemId]
        );
      } else {
        await this.databaseService.update(
          `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1`,
          [newAmount, correctedUserId, itemId]
        );
      }
      remainingToRemove -= toRemoveFromStack;
    }
  }

  async transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void> {
    const correctedFromUserId = await this.getCorrectedUserId(fromUserId);
    const correctedToUserId = await this.getCorrectedUserId(toUserId);

    // Vérifier que l'item existe dans l'inventaire du fromUser
    const items = await this.databaseService.read<(InventoryItem & { metadata: string | null })[]>(
      `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
      [correctedFromUserId, itemId, uniqueId]
    );

    if (items.length === 0) {
      throw new Error("Item not found in user's inventory");
    }

    // Transférer la propriété en changeant seulement le user_id
    await this.databaseService.update(
      `UPDATE inventories SET user_id = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
      [correctedToUserId, correctedFromUserId, itemId, uniqueId]
    );
  }
}
