import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Inventory, InventoryItem } from "../interfaces/Inventory";
import { IUserService } from "./UserService";
import { v4 as uuidv4 } from "uuid";

export interface IInventoryService {
  getInventory(userId: string): Promise<Inventory>;
  getItemAmount(userId: string, itemId: string): Promise<number>;
  addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }): Promise<void>;
  removeItem(userId: string, itemId: string, amount: number): Promise<void>;
  removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
  setItemAmount(userId: string, itemId: string, amount: number): Promise<void>; // Retiré metadata car non applicable
  updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: { [key: string]: unknown }): Promise<void>;
  hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
  hasItemWithoutMetadata(userId: string, itemId: string, amount?: number): Promise<boolean>;
}

@injectable()
export class InventoryService implements IInventoryService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("UserService") private userService: IUserService
  ) {}

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
    const items = await this.databaseService.read<(InventoryItem & { metadata: string | null })[]>(
      "SELECT user_id, item_id, amount, metadata FROM inventories WHERE user_id = ? AND amount > 0",
      [correctedUserId]
    );

    const processedItems: InventoryItem[] = items.map((item: InventoryItem & { metadata: string | null }) => ({
      user_id: item.user_id,
      item_id: item.item_id,
      amount: item.amount,
      metadata: this.parseMetadata(item.metadata ?? null)
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

  async addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    
    if (metadata) {
      // Items avec métadonnées : créer des entrées uniques pour chaque quantité
      const metadataWithUniqueId = { ...metadata, _unique_id: uuidv4() };
      
      for (let i = 0; i < amount; i++) {
        const uniqueMetadata = { ...metadataWithUniqueId, _unique_id: uuidv4() };
        await this.databaseService.update(
          "INSERT INTO inventories (user_id, item_id, amount, metadata) VALUES (?, ?, ?, ?)",
          [correctedUserId, itemId, 1, JSON.stringify(uniqueMetadata)]
        );
      }
    } else {
      // Items sans métadonnées : peuvent s'empiler
      const items = await this.databaseService.read<InventoryItem[]>(
        "SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL",
        [correctedUserId, itemId]
      );
      
      if (items.length > 0) {
        await this.databaseService.update(
          "UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL",
          [amount, correctedUserId, itemId]
        );
      } else {
        await this.databaseService.update(
          "INSERT INTO inventories (user_id, item_id, amount, metadata) VALUES (?, ?, ?, ?)",
          [correctedUserId, itemId, amount, null]
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

    // Items sans métadonnées seulement
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
        `INSERT INTO inventories (user_id, item_id, amount, metadata) VALUES (?, ?, ?, ?)`,
        [correctedUserId, itemId, amount, null]
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
    const items = await this.databaseService.read<(InventoryItem & { metadata: string | null })[]>(
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
          `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL`,
          [correctedUserId, itemId]
        );
      } else {
        await this.databaseService.update(
          `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL`,
          [newAmount, correctedUserId, itemId]
        );
      }
      remainingToRemove -= toRemoveFromStack;
    }
  }

  async removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    
    await this.databaseService.update(
      `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ? LIMIT 1`,
      [correctedUserId, itemId, uniqueId]
    );
  }

  async hasItem(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const totalAmount = await this.getItemAmount(userId, itemId);
    return totalAmount >= amount;
  }

  async hasItemWithoutMetadata(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const items = await this.databaseService.read<InventoryItem[]>(
      "SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL",
      [correctedUserId, itemId]
    );
    const totalAmount = items.length === 0 || !items[0].amount ? 0 : items[0].amount;
    return totalAmount >= amount;
  }
}
