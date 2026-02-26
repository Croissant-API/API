import { Item } from '../interfaces/Item';
import { IDatabaseService } from '../services/DatabaseService';

export class ItemRepository {
  constructor(private databaseService: IDatabaseService) {}

  async createItem(item: Omit<Item, 'id'>): Promise<void> {
    const db = await this.databaseService.getDb();
    const existing = await this.getItem(item.itemId);
    if (existing) throw new Error('ItemId already exists');
    await db.collection('items').insertOne({
      ...item,
      showInStore: !!item.showInStore,
      deleted: !!item.deleted
    });
  }

  async getItems(
    filters: { itemId?: string; owner?: string; showInStore?: boolean; deleted?: boolean; search?: string } = {},
    select: string = '*',
    orderBy: string = 'name',
    limit?: number
  ): Promise<Item[]> {
    const db = await this.databaseService.getDb();
    const query: any = {};
    if (filters.itemId) query.itemId = filters.itemId;
    if (filters.owner) query.owner = filters.owner;
    if (filters.showInStore !== undefined) query.showInStore = !!filters.showInStore;
    if (filters.deleted !== undefined) query.deleted = !!filters.deleted;
    if (filters.search) {
      query.name = { $regex: filters.search, $options: 'i' };
    }
    // select: if not '*', project only those fields
    let projection: any = undefined;
    if (select !== '*' && select.trim().length > 0) {
      projection = {};
      select.split(',').map(f => f.trim()).forEach(f => projection[f] = 1);
    }
    let cursor = db.collection('items').find(query, { projection });
    // orderBy
    if (orderBy) {
      const sort: any = {};
      sort[orderBy] = 1;
      cursor = cursor.sort(sort);
    }
    if (limit) cursor = cursor.limit(limit);
    const itemsIterations = await cursor.toArray();
    const items: Item[] = itemsIterations.map(doc => ({
      itemId: doc.itemId,
      name: doc.name,
      description: doc.description,
      price: doc.price,
      owner: doc.owner,
      iconHash: doc.iconHash,
      showInStore: doc.showInStore,
      deleted: doc.deleted
    }));
    return items as Item[];
    // return cursor.toArray() as Promise<Item[]>;
  }

  async getItem(itemId: string): Promise<Item | null> {
    const db = await this.databaseService.getDb();
    const items = await db.collection('items').find({ itemId }).toArray();
    if (items.length === 0) return null;
    const doc = items[0];
    return {
      itemId: doc.itemId,
      name: doc.name,
      description: doc.description,
      price: doc.price,
      owner: doc.owner,
      iconHash: doc.iconHash,
      showInStore: doc.showInStore,
      deleted: doc.deleted
    };
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

  async updateItem(
    itemId: string,
    item: Partial<Omit<Item, 'id' | 'itemId'>>,
    buildUpdateFields: (obj: Record<string, unknown>, skip?: string[]) => { fields: string[]; values: unknown[] }
  ): Promise<void> {
    const db = await this.databaseService.getDb();
    // buildUpdateFields is not needed for MongoDB, just use the item object
    if (!Object.keys(item).length) return;
    await db.collection('items').updateOne(
      { itemId },
      { $set: item }
    );
  }

  async deleteItem(itemId: string): Promise<void> {
    const db = await this.databaseService.getDb();
    await db.collection('items').updateOne({ itemId }, { $set: { deleted: true } });
  }

  async searchItemsByName(query: string): Promise<Item[]> {
    return this.getItems({ search: query, showInStore: true, deleted: false }, 'itemId, name, description, owner, price, iconHash, showInStore', 'name', 100);
  }
}
