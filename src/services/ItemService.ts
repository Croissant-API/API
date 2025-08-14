import { Item } from "interfaces/Item";
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";

export interface IItemService {
  createItem(item: Omit<Item, "id">): Promise<void>;
  getItem(itemId: string): Promise<Item | null>;
  getAllItems(): Promise<Item[]>;
  getStoreItems(): Promise<Item[]>;
  getMyItems(userId: string): Promise<Item[]>;
  updateItem(
    itemId: string,
    item: Partial<Omit<Item, "id" | "itemId" | "owner">>
  ): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
  searchItemsByName(query: string): Promise<Item[]>;
  transferOwnership(itemId: string, newOwnerId: string): Promise<void>;
}

@injectable()
export class ItemService implements IItemService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {}

  async createItem(item: Omit<Item, "id">): Promise<void> {
    // Check if itemId already exists (even if deleted)
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

  async updateItem(
    itemId: string,
    item: Partial<Omit<Item, "id" | "itemId">>
  ): Promise<void> {
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

  /**
   * Search items by name, only those with showInStore = true and not deleted
   */
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

  async transferOwnership( 
    itemId: string,
    newOwnerId: string
  ): Promise<void> {
    const item = await this.getItem(itemId);
    if (!item) throw new Error("Item not found");
    if (item.deleted) throw new Error("Cannot transfer deleted item");
    await this.updateItem(itemId, { owner: newOwnerId });
  }
}

function toDbBool(val: unknown) {
  return val ? 1 : 0;
}

function buildUpdateFields(obj: Record<string, unknown>, skip: string[] = []) {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key in obj) {
    if (skip.includes(key)) continue;
    fields.push(`${key} = ?`);
    values.push(["showInStore", "deleted"].includes(key) ? toDbBool(obj[key]) : obj[key]);
  }
  return { fields, values };
}
