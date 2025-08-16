import { Item } from "../interfaces/Item";
import { IDatabaseService } from "../services/DatabaseService";

export class ItemRepository {
  constructor(private databaseService: IDatabaseService) { }

  async createItem(item: Omit<Item, "id">): Promise<void> {
    const existingItems = await this.databaseService.read<Item>(
      "SELECT * FROM items WHERE itemId = ?",
      [item.itemId]
    );
    if (existingItems.length > 0) {
      throw new Error("ItemId already exists");
    }
    await this.databaseService.request(
      `INSERT INTO items (itemId, name, description, price, owner, iconHash, showInStore, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.itemId,
        item.name ?? null,
        item.description ?? null,
        item.price ?? 0,
        item.owner,
        item.iconHash ?? null,
        item.showInStore ? 1 : 0,
        item.deleted ? 1 : 0,
      ]
    );
  }

  async getItem(itemId: string): Promise<Item | null> {
    const items = await this.databaseService.read<Item>(
      "SELECT * FROM items WHERE itemId = ?",
      [itemId]
    );
    return items[0] || null;
  }

  async getAllItems(): Promise<Item[]> {
    return this.databaseService.read<Item>("SELECT * FROM items");
  }

  async getStoreItems(): Promise<Item[]> {
    return this.databaseService.read<Item>(
      `SELECT itemId, name, description, owner, price, iconHash, showInStore
       FROM items 
       WHERE deleted = 0 AND showInStore = 1
       ORDER BY name`
    );
  }

  async getMyItems(userId: string): Promise<Item[]> {
    return this.databaseService.read<Item>(
      `SELECT itemId, name, description, owner, price, iconHash, showInStore
       FROM items 
       WHERE deleted = 0 AND owner = ?
       ORDER BY name`,
      [userId]
    );
  }

  async updateItem(itemId: string, item: Partial<Omit<Item, "id" | "itemId">>, buildUpdateFields: (obj: Record<string, unknown>, skip?: string[]) => { fields: string[], values: unknown[] }): Promise<void> {
    const { fields, values } = buildUpdateFields(item);
    if (!fields.length) return;
    values.push(itemId);
    await this.databaseService.request(
      `UPDATE items SET ${fields.join(", ")} WHERE itemId = ?`,
      values
    );
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.databaseService.request("UPDATE items SET deleted = 1 WHERE itemId = ?", [itemId]);
  }

  async searchItemsByName(query: string): Promise<Item[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    return this.databaseService.read<Item>(
      `SELECT itemId, name, description, owner, price, iconHash, showInStore
       FROM items 
       WHERE LOWER(name) LIKE ? AND showInStore = 1 AND deleted = 0
       ORDER BY name LIMIT 100`,
      [searchTerm]
    );
  }
}
