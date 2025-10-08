import { InventoryItem } from '../interfaces/Inventory';
import { IDatabaseService } from '../services/DatabaseService';

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

  // Méthode générique pour récupérer les items selon des filtres
  async getInventory(filters: { userId?: string; itemId?: string; sellable?: boolean; purchasePrice?: number; uniqueId?: string; minAmount?: number } = {}): Promise<InventoryItem[]> {
    let query = `
      SELECT 
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
      WHERE 1=1
    `;
    const params = [];
    if (filters.userId) {
      query += ' AND inv.user_id = ?';
      params.push(filters.userId);
    }
    if (filters.itemId) {
      query += ' AND inv.item_id = ?';
      params.push(filters.itemId);
    }
    if (filters.sellable !== undefined) {
      query += ' AND inv.sellable = ?';
      params.push(filters.sellable ? 1 : 0);
    }
    if (filters.purchasePrice !== undefined) {
      query += ' AND (inv.purchasePrice = ? OR (inv.purchasePrice IS NULL AND ? IS NULL))';
      params.push(filters.purchasePrice, filters.purchasePrice);
    }
    if (filters.uniqueId) {
      query += " AND JSON_EXTRACT(inv.metadata, '$._unique_id') = ?";
      params.push(filters.uniqueId);
    }
    if (filters.minAmount !== undefined) {
      query += ' AND inv.amount >= ?';
      params.push(filters.minAmount);
    }
    const items = await this.databaseService.read<InventoryItem>(query, params);
    items.map(item => ({
      user_id: item.user_id,
      item_id: item.item_id,
      amount: item.amount,
      metadata: item.metadata,
      sellable: !!item.sellable,
      purchasePrice: item.purchasePrice,
      name: item.name,
      description: item.description,
      iconHash: item.iconHash,
      price: item.purchasePrice,
      rarity: item.rarity,
      custom_url_link: item.custom_url_link,
    }));
    return items;
  }

  // Surcharges utilisant la méthode générique
  async getInventoryItems(userId: string): Promise<InventoryItem[]> {
    return this.getInventory({ userId, minAmount: 1 });
  }

  async getItemAmount(userId: string, itemId: string): Promise<number> {
    const items = await this.getInventory({ userId, itemId });
    return items.reduce((sum, item) => sum + (item.amount || 0), 0);
  }

  async hasItemWithoutMetadata(userId: string, itemId: string, amount: number): Promise<boolean> {
    const items = await this.getInventory({ userId, itemId });
    const totalAmount = items.filter(i => !i.metadata).reduce((sum, i) => sum + (i.amount || 0), 0);
    return totalAmount >= amount;
  }

  async hasItemWithoutMetadataSellable(userId: string, itemId: string, amount: number): Promise<boolean> {
    const items = await this.getInventory({ userId, itemId, sellable: true });
    const totalAmount = items.filter(i => !i.metadata).reduce((sum, i) => sum + (i.amount || 0), 0);
    return totalAmount >= amount;
  }

  async addItem(userId: string, itemId: string, amount: number, metadata: { [key: string]: unknown } | undefined, sellable: boolean, purchasePrice: number | undefined, uuidv4: () => string): Promise<void> {
    if (metadata) {
      for (let i = 0; i < amount; i++) {
        const uniqueMetadata = { ...metadata, _unique_id: uuidv4() };
        await this.databaseService.request('INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice, rarity, custom_url_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [userId, itemId, 1, JSON.stringify(uniqueMetadata), sellable ? 1 : 0, purchasePrice, metadata['rarity'], metadata['custom_url_link']]);
      }
    } else {
      const items = await this.getInventory({ userId, itemId, sellable, purchasePrice });
      if (items.length > 0) {
        await this.databaseService.request('UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND (purchasePrice = ? OR (purchasePrice IS NULL AND ? IS NULL))', [amount, userId, itemId, sellable ? 1 : 0, purchasePrice, purchasePrice]);
      } else {
        await this.databaseService.request('INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)', [userId, itemId, amount, null, sellable ? 1 : 0, purchasePrice]);
      }
    }
  }

  async setItemAmount(userId: string, itemId: string, amount: number): Promise<void> {
    if (amount <= 0) {
      await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ?`, [userId, itemId]);
      return;
    }
    const items = await this.getInventory({ userId, itemId });
    if (items.length > 0) {
      await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL`, [amount, userId, itemId]);
    } else {
      await this.databaseService.request(`INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)`, [userId, itemId, amount, null, 0, null]);
    }
  }

  async updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: object): Promise<void> {
    const metadataWithUniqueId = { ...metadata, _unique_id: uniqueId };
    const metadataJson = JSON.stringify(metadataWithUniqueId);
    await this.databaseService.request("UPDATE inventories SET metadata = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?", [metadataJson, userId, itemId, uniqueId]);
  }

  async removeItem(userId: string, itemId: string, amount: number, dataItemIndex?: number): Promise<void> {
    const items = await this.getInventory({ userId, itemId });
    // Si dataItemIndex est défini, on ne retire que sur ce stack précis
    if (typeof dataItemIndex === 'number' && items[dataItemIndex]) {
      const item = items[dataItemIndex];
      const toRemoveFromStack = Math.min(amount, item.amount);
      const newAmount = item.amount - toRemoveFromStack;
      if (newAmount <= 0) {
        await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND sellable = ? AND amount = ?  AND purchasePrice = ? LIMIT 1`, [userId, item.item_id, item.sellable ? 1 : 0, item.amount, item.purchasePrice]);
      } else {
        await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND amount = ? AND purchasePrice = ? LIMIT 1`, [newAmount, userId, item.item_id, item.sellable ? 1 : 0, item.amount, item.purchasePrice]);
      }
      return;
    }
    // Sinon, comportement classique (réparti sur tous les stacks)
    let remainingToRemove = amount;
    for (const item of items) {
      if (remainingToRemove <= 0) break;
      const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
      const newAmount = item.amount - toRemoveFromStack;
      if (newAmount <= 0) {
        await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND amount = ? LIMIT 1`, [userId, itemId, item.sellable ? 1 : 0, item.amount]);
      } else {
        await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND amount = ? LIMIT 1`, [newAmount, userId, itemId, item.sellable ? 1 : 0, item.amount]);
      }
      remainingToRemove -= toRemoveFromStack;
    }
  }

  async removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void> {
    await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`, [userId, itemId, uniqueId]);
  }

  async removeSellableItem(userId: string, itemId: string, amount: number): Promise<void> {
    const items = await this.getInventory({ userId, itemId, sellable: true });
    let remainingToRemove = amount;
    for (const item of items) {
      if (remainingToRemove <= 0) break;
      const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
      const newAmount = item.amount - toRemoveFromStack;
      if (newAmount <= 0) {
        await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1`, [userId, itemId]);
      } else {
        await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1`, [newAmount, userId, itemId]);
      }
      remainingToRemove -= toRemoveFromStack;
    }
  }

  async removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number, dataItemIndex?: number): Promise<void> {
    const items = await this.getInventory({ userId, itemId, sellable: true, purchasePrice });
    // Si dataItemIndex est défini, on ne retire que sur ce stack précis
    if (typeof dataItemIndex === 'number' && items[dataItemIndex]) {
      const item = items[dataItemIndex];
      const toRemoveFromStack = Math.min(amount, item.amount);
      const newAmount = item.amount - toRemoveFromStack;
      if (newAmount <= 0) {
        await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND amount = ? AND purchasePrice = ? LIMIT 1`, [userId, itemId, item.amount, purchasePrice]);
      } else {
        await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND amount = ? AND purchasePrice = ? LIMIT 1`, [newAmount, userId, itemId, item.amount, purchasePrice]);
      }
      return;
    }
    // Sinon, comportement classique (réparti sur tous les stacks)
    let remainingToRemove = amount;
    for (const item of items) {
      if (remainingToRemove <= 0) break;
      const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
      const newAmount = item.amount - toRemoveFromStack;
      if (newAmount <= 0) {
        await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND amount = ? AND purchasePrice = ? LIMIT 1`, [userId, itemId, item.amount, purchasePrice]);
      } else {
        await this.databaseService.request(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND amount = ? AND purchasePrice = ? LIMIT 1`, [newAmount, userId, itemId, item.amount, purchasePrice]);
      }
      remainingToRemove -= toRemoveFromStack;
    }
  }

  async transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void> {
    await this.databaseService.request(`UPDATE inventories SET user_id = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`, [toUserId, fromUserId, itemId, uniqueId]);
  }
}
