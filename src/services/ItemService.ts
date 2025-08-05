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
  private readonly tableName = 'items';

  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {}

  async createItem(item: Omit<Item, "id">): Promise<void> {
    const knex = this.databaseService.getKnex();
    try {
      // Check if itemId already exists (even if deleted)
      const existingItems = await knex(this.tableName)
        .where({ itemId: item.itemId })
        .select('*');

      if (existingItems.length > 0) {
        throw new Error("ItemId already exists");
      }

      await knex(this.tableName).insert({
        itemId: item.itemId,
        name: item.name ?? null,
        description: item.description ?? null,
        price: item.price ?? 0,
        owner: item.owner,
        iconHash: item.iconHash ?? null,
        showInStore: toDbBool(item.showInStore),
        deleted: toDbBool(item.deleted),
      });
    } catch (error) {
      console.error("Error creating item:", error);
      throw error;
    }
  }

  async getItem(itemId: string): Promise<Item | null> {
    const knex = this.databaseService.getKnex();
    try {
      const items = await knex(this.tableName)
        .where({ itemId: itemId })
        .select('*');
      return items[0] || null;
    } catch (error) {
      console.error("Error getting item:", error);
      throw error;
    }
  }

  async getAllItems(): Promise<Item[]> {
    const knex = this.databaseService.getKnex();
    try {
      return await knex(this.tableName).select('*');
    } catch (error) {
      console.error("Error getting all items:", error);
      throw error;
    }
  }

  async getStoreItems(): Promise<Item[]> {
    const knex = this.databaseService.getKnex();
    try {
      return await knex(this.tableName)
        .select(
          'itemId',
          'name',
          'description',
          'owner',
          'price',
          'iconHash',
          'showInStore'
        )
        .where({ deleted: 0, showInStore: 1 })
        .orderBy('name');
    } catch (error) {
      console.error("Error getting store items:", error);
      throw error;
    }
  }

  async getMyItems(userId: string): Promise<Item[]> {
    const knex = this.databaseService.getKnex();
    try {
      return await knex(this.tableName)
        .select(
          'itemId',
          'name',
          'description',
          'owner',
          'price',
          'iconHash',
          'showInStore'
        )
        .where({ deleted: 0, owner: userId })
        .orderBy('name');
    } catch (error) {
      console.error("Error getting my items:", error);
      throw error;
    }
  }

  async updateItem(
    itemId: string,
    item: Partial<Omit<Item, "id" | "itemId" | "owner">>
  ): Promise<void> {
    const knex = this.databaseService.getKnex();
    try {
      const { fields, values } = buildUpdateFields(item);
      if (!fields.length) return;
      await knex(this.tableName)
        .where({ itemId: itemId })
        .update(Object.fromEntries(fields.map((field, index) => [field.split(' = ?')[0], values[index]])));
    } catch (error) {
      console.error("Error updating item:", error);
      throw error;
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    const knex = this.databaseService.getKnex();
    try {
      await knex(this.tableName)
        .where({ itemId: itemId })
        .update({ deleted: 1 });
    } catch (error) {
      console.error("Error deleting item:", error);
      throw error;
    }
  }

  /**
   * Search items by name, only those with showInStore = true and not deleted
   */
  async searchItemsByName(query: string): Promise<Item[]> {
    const knex = this.databaseService.getKnex();
    const searchTerm = `%${query.toLowerCase()}%`;
    try {
      return await knex(this.tableName)
        .select(
          'itemId',
          'name',
          'description',
          'owner',
          'price',
          'iconHash',
          'showInStore'
        )
        .where({ showInStore: 1, deleted: 0 })
        .andWhere('name', 'like', searchTerm)
        .orderBy('name');
    } catch (error) {
      console.error("Error searching items by name:", error);
      throw error;
    }
  }

  async transferOwnership( 
    itemId: string,
    newOwnerId: string
  ): Promise<void> {
    const knex = this.databaseService.getKnex();
    try {
      const item = await this.getItem(itemId);
      if (!item) throw new Error("Item not found");
      if (item.deleted) throw new Error("Cannot transfer deleted item");
      await knex(this.tableName)
        .where({ itemId: itemId })
        .update({ owner: newOwnerId });
    } catch (error) {
      console.error("Error transferring ownership:", error);
      throw error;
    }
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
