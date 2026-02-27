import { Item } from '../interfaces/Item';
import { IDatabaseService } from '../services/DatabaseService';

export class ItemRepository {
  constructor(private databaseService: IDatabaseService) {}

  private items() {
    return this.databaseService.from<Item>('items');
  }

  async createItem(item: Omit<Item, 'id'>): Promise<void> {
    const existing = await this.getItem(item.itemId);
    if (existing) throw new Error('ItemId already exists');
    const row: Partial<Item> = {
      ...item,
      showInStore: item.showInStore ? 1 : 0,
      deleted: item.deleted ? 1 : 0,
    };
    const { error } = await this.items().insert(row);
    if (error) throw error;
  }

  async getItems(filters: { itemId?: string; owner?: string; showInStore?: boolean; deleted?: boolean; search?: string } = {}, select: string = '*', orderBy: string = 'name', limit?: number): Promise<Item[]> {
    let query = this.items().select(select);
    if (filters.itemId) {
      query = query.eq('itemId', filters.itemId);
    }
    if (filters.owner) {
      query = query.eq('owner', filters.owner);
    }
    if (filters.showInStore !== undefined) {
      query = query.eq('showInStore', filters.showInStore ? 1 : 0);
    }
    if (filters.deleted !== undefined) {
      query = query.eq('deleted', filters.deleted ? 1 : 0);
    }
    if (filters.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      query = query.ilike('name', term);
    }
    if (orderBy) {
      query = query.order(orderBy);
    }
    if (limit) {
      query = query.limit(limit);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getItem(itemId: string): Promise<Item | null> {
    const items = await this.getItems({ itemId });
    return items[0] || null;
  }

  async getAllItems(): Promise<Item[]> {
    return this.getItems();
  }

  async getStoreItems(): Promise<Item[]> {
    return this.getItems({ showInStore: true, deleted: false }, 'itemId, name, description, owner, price, iconHash, showInStore');
  }

  async getMyItems(userId: string): Promise<Item[]> {
    return this.getItems({ owner: userId, deleted: false }, 'itemId, name, description, owner, price, iconHash, showInStore');
  }

  async updateItem(itemId: string, item: Partial<Omit<Item, 'id' | 'itemId'>>, buildUpdateFields: (obj: Record<string, unknown>, skip?: string[]) => { fields: string[]; values: unknown[] }): Promise<void> {
    const { fields, values } = buildUpdateFields(item);
    if (!fields.length) return;
    const obj: Record<string, unknown> = {};
    fields.forEach((f, i) => {
      const key = f.split('=')[0].trim();
      obj[key] = values[i];
    });
    const { error } = await this.items().update(obj).eq('itemId', itemId);
    if (error) throw error;
  }

  async deleteItem(itemId: string): Promise<void> {
    const { error } = await this.items().update({ deleted: 1 }).eq('itemId', itemId);
    if (error) throw error;
  }

  async searchItemsByName(query: string): Promise<Item[]> {
    return this.getItems({ search: query, showInStore: true, deleted: false }, 'itemId, name, description, owner, price, iconHash, showInStore', 'name', 100);
  }
}
