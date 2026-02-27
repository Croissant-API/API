import { InventoryItem } from '../interfaces/Inventory';
import { EnrichedMarketListing, MarketListing } from '../interfaces/MarketListing';
import { IDatabaseService } from '../services/DatabaseService';

export class MarketListingRepository {
  constructor(private databaseService: IDatabaseService) {}

  private listings() {
    return this.databaseService.from<MarketListing>('market_listings');
  }

  private inventories() {
    // we don't know full shape here so use any
    return this.databaseService.from<any>('inventories');
  }

  private buyOrders() {
    return this.databaseService.from<any>('buy_orders');
  }

  private items() {
    return this.databaseService.from<any>('items');
  }

  async insertMarketListing(listing: MarketListing): Promise<void> {
    const { error } = await this.listings().insert(listing);
    if (error) throw error;
  }

  // --- INVENTORY HELPERS ---
  async removeInventoryItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void> {
    if (this.databaseService.isPostgres()) {
      const { error } = await this.inventories()
        .delete()
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .filter("metadata->>_unique_id", "eq", uniqueId);
      if (error) throw error;
    } else {
      // sqlite fallback still needs raw SQL
      const uniqueClause = "JSON_EXTRACT(metadata, '$._unique_id') = ?";
      await this.databaseService.request(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND ${uniqueClause}`, [userId, itemId, uniqueId]);
    }
  }

  async updateInventoryAmountOrDelete(userId: string, itemId: string, purchasePrice: number): Promise<void> {
    const { data, error } = await this.inventories()
      .select('amount')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('purchasePrice', purchasePrice)
      .limit(1);
    if (error) throw error;
    const row = data && data[0];
    if (row && row.amount > 1) {
      const { error: err } = await this.inventories()
        .update({ amount: row.amount - 1 })
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .eq('purchasePrice', purchasePrice);
      if (err) throw err;
    } else {
      const { error: err } = await this.inventories()
        .delete()
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .eq('purchasePrice', purchasePrice);
      if (err) throw err;
    }
  }

  async decrementOrDeleteInventory(userId: string, itemId: string): Promise<void> {
    // decrement using PostgREST increment helper
    await this.inventories()
      .update({})
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .gt('amount', 0)
      .increment('amount', -1);

    await this.inventories()
      .delete()
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('amount', 0);
  }

  // --- MARKET LISTING GENERIC GETTER ---
  async getMarketListings(
    filters: { id?: string; sellerId?: string; itemId?: string; status?: string } = {},
    select: string = '*',
    orderBy: string = 'created_at DESC',
    limit?: number
  ): Promise<MarketListing[]> {
    let query = this.listings().select(select as any);
    if (filters.id) query = query.eq('id', filters.id);
    if (filters.sellerId) query = query.eq('seller_id', filters.sellerId);
    if (filters.itemId) query = query.eq('item_id', filters.itemId);
    if (filters.status) query = query.eq('status', filters.status);

    // apply ordering (only basic support)
    const parts = orderBy.split(',').map(p => p.trim());
    for (const part of parts) {
      const [col, dir] = part.split(' ');
      query = query.order(col, { ascending: (dir || 'DESC').toUpperCase() === 'ASC' });
    }

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // --- Surcharges utilisant la méthode générique ---
  async getMarketListingById(listingId: string, sellerId?: string): Promise<MarketListing | null> {
    const listings = await this.getMarketListings({ id: listingId, sellerId, status: 'active' });
    return listings[0] || null;
  }

  async getMarketListingByIdAnyStatus(listingId: string): Promise<MarketListing | null> {
    const listings = await this.getMarketListings({ id: listingId });
    return listings[0] || null;
  }

  async getMarketListingsByUser(userId: string): Promise<EnrichedMarketListing[]> {
    // select nested item data and map to enriched shape
    const { data, error } = await this.listings()
      .select('*, items!inner(name, description, iconHash)')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      item_name: row.items.name,
      item_description: row.items.description,
      item_icon_hash: row.items.iconHash,
    }));
  }

  async getActiveListingsForItem(itemId: string): Promise<MarketListing[]> {
    return this.getMarketListings({ itemId, status: 'active' }, '*', 'price ASC, created_at ASC');
  }

  async getEnrichedMarketListings(limit: number, offset: number): Promise<EnrichedMarketListing[]> {
    const { data, error } = await this.listings()
      .select('*, items!inner(name, description, iconHash)')
      .eq('status', 'active')
      .not('items.deleted', 'is', 1)
      .order('created_at', { ascending: false })
      .limit(limit)
      .offset(offset);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      item_name: row.items.name,
      item_description: row.items.description,
      item_icon_hash: row.items.iconHash,
    }));
  }

  async searchMarketListings(searchTerm: string, limit: number): Promise<EnrichedMarketListing[]> {
    const { data, error } = await this.listings()
      .select('*, items!inner(name, description, iconHash)')
      .eq('status', 'active')
      .not('items.deleted', 'is', 1)
      .like('items.name', `%${searchTerm}%`)
      .order('price', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      item_name: row.items.name,
      item_description: row.items.description,
      item_icon_hash: row.items.iconHash,
    }));
  }

  // --- UPDATE STATUS ---
  async updateMarketListingStatus(listingId: string, status: string, updatedAt: string): Promise<void> {
    const { error } = await this.listings().update({ status, updated_at: updatedAt }).eq('id', listingId);
    if (error) throw error;
  }

  async updateMarketListingSold(listingId: string, buyerId: string, now: string): Promise<void> {
    const { error } = await this.listings()
      .update({ status: 'sold', buyer_id: buyerId, sold_at: now, updated_at: now })
      .eq('id', listingId);
    if (error) throw error;
  }

  async updateBuyOrderToFulfilled(buyOrderId: string, now: string): Promise<void> {
    const { error } = await this.buyOrders()
      .update({ status: 'fulfilled', fulfilled_at: now, updated_at: now })
      .eq('id', buyOrderId);
    if (error) throw error;
  }

  // --- INVENTORY ADD ---
  async addItemToInventory(inventoryItem: InventoryItem): Promise<void> {
    if (inventoryItem.metadata && inventoryItem.metadata._unique_id) {
      const { error } = await this.inventories().insert({
        user_id: inventoryItem.user_id,
        item_id: inventoryItem.item_id,
        amount: inventoryItem.amount,
        metadata: inventoryItem.metadata,
        sellable: inventoryItem.sellable,
        purchasePrice: inventoryItem.purchasePrice,
      });
      if (error) throw error;
    } else {
      const { data } = await this.inventories()
        .select('*')
        .eq('user_id', inventoryItem.user_id)
        .eq('item_id', inventoryItem.item_id)
        .eq('purchasePrice', inventoryItem.purchasePrice || null)
        .limit(1);
      if (data && data.length > 0) {
        const existing = data[0];
        const { error } = await this.inventories()
          .update({ amount: existing.amount + inventoryItem.amount })
          .eq('user_id', inventoryItem.user_id)
          .eq('item_id', inventoryItem.item_id)
          .eq('purchasePrice', inventoryItem.purchasePrice || null);
        if (error) throw error;
      } else {
        const { error } = await this.inventories().insert({
          user_id: inventoryItem.user_id,
          item_id: inventoryItem.item_id,
          amount: inventoryItem.amount,
          metadata: null,
          sellable: inventoryItem.sellable,
          purchasePrice: inventoryItem.purchasePrice,
        });
        if (error) throw error;
      }
    }
  }
}
