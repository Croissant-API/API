import { Item } from "interfaces/Item";
import { inject, injectable } from "inversify";
import { IDatabaseService } from '../services/database';

export interface IItemService {
  createItem(itemId: string, name: string, description: string, price: number, owner: string): Promise<void>;
  getItem(itemId: string): Promise<Item | null>;
  getAllItems(): Promise<Item[]>;
  updateItem(itemId: string, name?: string, description?: string, price?: number): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
}

@injectable()
export class ItemService implements IItemService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) { }

  async createItem(itemId: string, name: string, description: string, price: number, owner: string): Promise<void> {
    // Check if itemId already exists (even if deleted)
    const existingItems = await this.databaseService.read<Item[]>(
      "SELECT * FROM items WHERE itemId = ?",
      [itemId]
    );
    if (existingItems.length > 0) {
      throw new Error("ItemId already exists");
    }
    await this.databaseService.create(
      "INSERT INTO items (itemId, name, description, price, owner) VALUES (?, ?, ?, ?, ?)",
      [itemId, name, description, price, owner]
    );
  }
  

  getItem(itemId: string): Promise<Item | null> {
    return new Promise((resolve, reject) => {
      this.databaseService.read<Item[]>("SELECT * FROM items")
      .then((items) => {
        const item = items.find((item) => item.itemId === itemId) || null;
        resolve(item);
      })
      .catch(reject);
    });
  }

  getAllItems(): Promise<Item[]> {
    return new Promise((resolve, reject) => {
      this.databaseService.read<Item[]>("SELECT * FROM items")
        .then(resolve)
        .catch(reject);
    });
  }

  updateItem(itemId: string, name?: string, description?: string, price?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.databaseService.update(
        "UPDATE items SET name = ?, description = ?, price = ? WHERE itemId = ?",
        [name, description, price, itemId]
      ).then(resolve).catch(reject);
    });
  }

  deleteItem(itemId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.databaseService.delete(
        "UPDATE items SET deleted = 1 WHERE itemId = ?",
        [itemId]
      ).then(resolve).catch(reject);
    });
  }
}
