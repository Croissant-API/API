import { InventoryItem } from "../interfaces/Inventory";
import { IDatabaseService } from "../services/DatabaseService";

export class InventoryRepository {
  constructor(private databaseService: IDatabaseService) {}

  async deleteNonExistingItems(userId: string): Promise<void> {
    await this.databaseService.request(
      `DELETE FROM inventories 
       WHERE user_id = ? 
       AND item_id NOT IN (
         SELECT itemId FROM items WHERE deleted IS NULL OR deleted = 0
       )`,
      [userId]
    );
  }

  async getInventoryItems(userId: string): Promise<InventoryItem[]> {
    return await this.databaseService.read<InventoryItem>(
      `SELECT 
         inv.user_id, 
         inv.item_id, 
         inv.amount, 
         inv.metadata,
         inv.sellable,
         inv.purchasePrice,
         inv.rarity,
         inv.custom_url_link,
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
      [userId]
    );
  }

  async getItemAmount(userId: string, itemId: string): Promise<number> {
    const items = await this.databaseService.read<InventoryItem>(
      "SELECT SUM(amount) as amount FROM inventories WHERE user_id = ? AND item_id = ?",
      [userId, itemId]
    );
    return items.length === 0 || !items[0].amount ? 0 : items[0].amount;
  }

  async addItem(userId: string, itemId: string, amount: number, metadata: { [key: string]: unknown } | undefined, sellable: boolean, purchasePrice: number | undefined, uuidv4: () => string): Promise<void> {
    if (metadata) {
      const metadataWithUniqueId = { ...metadata, _unique_id: uuidv4() };
      for (let i = 0; i < amount; i++) {
        const uniqueMetadata = { ...metadataWithUniqueId, _unique_id: uuidv4() };
        await this.databaseService.request(
          "INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice, rarity, custom_url_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [userId, itemId, 1, JSON.stringify(uniqueMetadata), sellable ? 1 : 0, purchasePrice, metadata["rarity"], metadata["custom_url_link"]]
        );
      }
    } else {
      const items = await this.databaseService.read<InventoryItem[]>(
        "SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND (purchasePrice = ? OR (purchasePrice IS NULL AND ? IS NULL))",
        [userId, itemId, sellable ? 1 : 0, purchasePrice, purchasePrice]
      );
      if (items.length > 0) {
        await this.databaseService.request(
          "UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND (purchasePrice = ? OR (purchasePrice IS NULL AND ? IS NULL))",
          [amount, userId, itemId, sellable ? 1 : 0, purchasePrice, purchasePrice]
        );
      } else {
        await this.databaseService.request(
          "INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)",
          [userId, itemId, amount, null, sellable ? 1 : 0, purchasePrice]
        );
      }
    }
  }

  async setItemAmount(userId: string, itemId: string, amount: number): Promise<void> {
    if (amount <= 0) {
      await this.databaseService.request(
        `DELETE FROM inventories WHERE user_id = ? AND item_id = ?`,
        [userId, itemId]
      );
      return;
    }
    const items = await this.databaseService.read<InventoryItem[]>(
      "SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL",
      [userId, itemId]
    );
    if (items.length > 0) {
      await this.databaseService.request(
        `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL`,
        [amount, userId, itemId]
      );
    } else {
      await this.databaseService.request(
        `INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, itemId, amount, null, 0, null]
      );
    }
  }

  async updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: object): Promise<void> {
    const metadataWithUniqueId = { ...metadata, _unique_id: uniqueId };
    const metadataJson = JSON.stringify(metadataWithUniqueId);
    await this.databaseService.request(
      "UPDATE inventories SET metadata = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?",
      [metadataJson, userId, itemId, uniqueId]
    );
  }

  async removeItem(userId: string, itemId: string, amount: number): Promise<void> {
    // On récupère tous les stacks correspondants, triés par amount DESC pour vider les plus gros d'abord
    const items = await this.databaseService.read<InventoryItem>(
      `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL ORDER BY amount DESC`,
      [userId, itemId]
    );
    let remainingToRemove = amount;
    for (const item of items) {
      if (remainingToRemove <= 0) break;
      const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
      const newAmount = item.amount - toRemoveFromStack;
      if (newAmount <= 0) {
        // On supprime uniquement ce stack précis (en utilisant l'id unique du stack si possible)
        await this.databaseService.request(
          `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND amount = ? LIMIT 1`,
          [userId, itemId, item.sellable ? 1 : 0, item.amount]
        );
      } else {
        await this.databaseService.request(
          `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND amount = ? LIMIT 1`,
          [newAmount, userId, itemId, item.sellable ? 1 : 0, item.amount]
        );
      }
      remainingToRemove -= toRemoveFromStack;
    }
  }

  async removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void> {
    await this.databaseService.request(
      `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
      [userId, itemId, uniqueId]
    );
  }

  async hasItemWithoutMetadata(userId: string, itemId: string, amount: number): Promise<boolean> {
    const items = await this.databaseService.read<{ total: number | null }>(
      "SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL",
      [userId, itemId]
    );
    const totalAmount = items.length === 0 || !items[0].total ? 0 : items[0].total;
    return totalAmount >= amount;
  }

  async hasItemWithoutMetadataSellable(userId: string, itemId: string, amount: number): Promise<boolean> {
    const items = await this.databaseService.read<{ total: number | null }>(
      "SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1",
      [userId, itemId]
    );
    const totalAmount = items.length === 0 || !items[0].total ? 0 : items[0].total;
    return totalAmount >= amount;
  }

  async removeSellableItem(userId: string, itemId: string, amount: number): Promise<void> {
    const items = await this.databaseService.read<InventoryItem>(
      `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 ORDER BY amount DESC`,
      [userId, itemId]
    );
    let remainingToRemove = amount;
    for (const item of items) {
      if (remainingToRemove <= 0) break;
      const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
      const newAmount = item.amount - toRemoveFromStack;
      if (newAmount <= 0) {
        await this.databaseService.request(
          `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1`,
          [userId, itemId]
        );
      } else {
        await this.databaseService.request(
          `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1`,
          [newAmount, userId, itemId]
        );
      }
      remainingToRemove -= toRemoveFromStack;
    }
  }

  async removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number): Promise<void> {
    const items = await this.databaseService.read<InventoryItem>(
      `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND purchasePrice = ? ORDER BY amount DESC`,
      [userId, itemId, purchasePrice]
    );
    let remainingToRemove = amount;
    for (const item of items) {
      if (remainingToRemove <= 0) break;
      const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
      const newAmount = item.amount - toRemoveFromStack;
      if (newAmount <= 0) {
        await this.databaseService.request(
          `DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND purchasePrice = ?`,
          [userId, itemId, purchasePrice]
        );
      } else {
        await this.databaseService.request(
          `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND purchasePrice = ?`,
          [newAmount, userId, itemId, purchasePrice]
        );
      }
      remainingToRemove -= toRemoveFromStack;
    }
  }

  async transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void> {
    const items = await this.databaseService.read<(InventoryItem & { metadata: string | null })[]>(
      `SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
      [fromUserId, itemId, uniqueId]
    );
    if (items.length === 0) {
      throw new Error("Item not found in user's inventory");
    }
    await this.databaseService.request(
      `UPDATE inventories SET user_id = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
      [toUserId, fromUserId, itemId, uniqueId]
    );
  }
}
