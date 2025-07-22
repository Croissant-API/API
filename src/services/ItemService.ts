import { Item } from "interfaces/Item";
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";

export interface IItemService {
  createItem(item: Omit<Item, "id">): Promise<void>;
  getItem(itemId: string): Promise<Item | null>;
  getAllItems(): Promise<Item[]>;
  updateItem(
    itemId: string,
    item: Partial<Omit<Item, "id" | "itemId" | "owner">>
  ): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
  searchItemsByName(query: string): Promise<Item[]>;
}

@injectable()
export class ItemService implements IItemService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {}

  async createItem(item: Omit<Item, "id">): Promise<void> {
    // Check if itemId already exists (even if deleted)
    const existingItems = await this.databaseService.read<Item[]>(
      "SELECT * FROM items WHERE itemId = ?",
      [item.itemId]
    );
    if (existingItems.length > 0) {
      throw new Error("ItemId already exists");
    }
    await this.databaseService.create(
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

  getItem(itemId: string): Promise<Item | null> {
    return new Promise((resolve, reject) => {
      this.databaseService
        .read<Item[]>("SELECT * FROM items")
        .then((items) => {
          const item = items.find((item) => item.itemId === itemId) || null;
          resolve(item);
        })
        .catch(reject);
    });
  }

  getAllItems(): Promise<Item[]> {
    return new Promise((resolve, reject) => {
      this.databaseService
        .read<Item[]>("SELECT * FROM items")
        .then(resolve)
        .catch(reject);
    });
  }

  async updateItem(
    itemId: string,
    item: Partial<Omit<Item, "id" | "itemId" | "owner">>
  ): Promise<void> {
    const fields = [];
    const values = [];
    for (const key in item) {
      fields.push(`${key} = ?`);
      values.push(item[key as keyof typeof item]);
    }
    if (fields.length === 0) return;
    values.push(itemId);
    await this.databaseService.update(
      `UPDATE items SET ${fields.join(", ")} WHERE itemId = ?`,
      values
    );
  }

  deleteItem(itemId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.databaseService
        .delete("UPDATE items SET deleted = 1 WHERE itemId = ?", [itemId])
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Search items by name, only those with showInStore = true and not deleted
   */
  async searchItemsByName(query: string): Promise<Item[]> {
    return this.databaseService.read<Item[]>(
      "SELECT * FROM items WHERE name LIKE ? AND showInStore = 1 AND deleted = 0",
      [`%${query}%`]
    );
  }
}
