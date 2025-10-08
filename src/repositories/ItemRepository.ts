import { Item } from '../interfaces/Item';
import { IDatabaseService } from '../services/DatabaseService';

export class ItemRepository {
  constructor(private databaseService: IDatabaseService) {}

  async createItem(item: Omit<Item, 'id'>): Promise<void> {
    const existing = await this.getItem(item.itemId);
    if (existing) throw new Error('ItemId already exists');
    await this.databaseService.request(
      `INSERT INTO items (itemId, name, description, price, owner, iconHash, showInStore, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.itemId, item.name ?? null, item.description ?? null, item.price ?? 0, item.owner, item.iconHash ?? null, item.showInStore ? 1 : 0, item.deleted ? 1 : 0]
    );
  }

  // Méthode générique pour récupérer les items selon des filtres
  async getItems(filters: { itemId?: string; owner?: string; showInStore?: boolean; deleted?: boolean; search?: string } = {}, select: string = '*', orderBy: string = 'name', limit?: number): Promise<Item[]> {
    let query = `SELECT ${select} FROM items WHERE 1=1`;
    const params = [];
    if (filters.itemId) {
      query += ' AND itemId = ?';
      params.push(filters.itemId);
    }
    if (filters.owner) {
      query += ' AND owner = ?';
      params.push(filters.owner);
    }
    if (filters.showInStore !== undefined) {
      query += ' AND showInStore = ?';
      params.push(filters.showInStore ? 1 : 0);
    }
    if (filters.deleted !== undefined) {
      query += ' AND deleted = ?';
      params.push(filters.deleted ? 1 : 0);
    }
    if (filters.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      query += ' AND LOWER(name) LIKE ?';
      params.push(searchTerm);
    }
    query += ` ORDER BY ${orderBy}`;
    if (limit) query += ` LIMIT ${limit}`;
    return this.databaseService.read<Item>(query, params);
  }

  // Surcharges utilisant la méthode générique
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
    values.push(itemId);
    await this.databaseService.request(`UPDATE items SET ${fields.join(', ')} WHERE itemId = ?`, values);
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.databaseService.request('UPDATE items SET deleted = 1 WHERE itemId = ?', [itemId]);
  }

  async searchItemsByName(query: string): Promise<Item[]> {
    return this.getItems({ search: query, showInStore: true, deleted: false }, 'itemId, name, description, owner, price, iconHash, showInStore', 'name', 100);
  }
}
