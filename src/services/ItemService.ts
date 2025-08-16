import { Item } from "interfaces/Item";
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { ItemRepository } from "../repositories/ItemRepository";

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
  private itemRepository: ItemRepository;
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {
    this.itemRepository = new ItemRepository(this.databaseService);
  }

  async createItem(item: Omit<Item, "id">): Promise<void> {
    await this.itemRepository.createItem(item);
  }

  async getItem(itemId: string): Promise<Item | null> {
    return this.itemRepository.getItem(itemId);
  }

  async getAllItems(): Promise<Item[]> {
    return this.itemRepository.getAllItems();
  }

  async getStoreItems(): Promise<Item[]> {
    return this.itemRepository.getStoreItems();
  }

  async getMyItems(userId: string): Promise<Item[]> {
    return this.itemRepository.getMyItems(userId);
  }

  async updateItem(
    itemId: string,
    item: Partial<Omit<Item, "id" | "itemId">>
  ): Promise<void> {
    await this.itemRepository.updateItem(itemId, item, buildUpdateFields);
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.itemRepository.deleteItem(itemId);
  }

  async searchItemsByName(query: string): Promise<Item[]> {
    return this.itemRepository.searchItemsByName(query);
  }

  async transferOwnership(itemId: string, newOwnerId: string): Promise<void> {
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
