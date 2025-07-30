/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { IInventoryService } from "./InventoryService";
import { IUserService } from "./UserService";
import { IItemService } from "./ItemService";
import { 
  MarketplaceSale, 
  MarketplaceBuyOrder, 
  CreateSaleRequest,
  CreateBuyOrderRequest,
  MarketplaceSaleWithDetails,
  MarketplaceBuyOrderWithDetails
} from "../interfaces/Marketplace";
import { v4 as uuidv4 } from "uuid";

export interface IMarketplaceService {
  // Sales
  createSale(userId: string, saleData: CreateSaleRequest): Promise<MarketplaceSale>;
  cancelSale(saleId: string, userId: string): Promise<void>;
  getSaleById(saleId: string): Promise<MarketplaceSaleWithDetails | null>;
  getActiveSales(itemId?: string, limit?: number, offset?: number): Promise<MarketplaceSaleWithDetails[]>;
  getUserSales(userId: string, status?: string): Promise<MarketplaceSaleWithDetails[]>;
  
  // Buy Orders
  createBuyOrder(userId: string, orderData: CreateBuyOrderRequest): Promise<MarketplaceBuyOrder[]>;
  cancelBuyOrder(orderId: string, userId: string): Promise<void>;
  getBuyOrderById(orderId: string): Promise<MarketplaceBuyOrderWithDetails | null>;
  getActiveBuyOrders(itemId?: string, limit?: number, offset?: number): Promise<MarketplaceBuyOrderWithDetails[]>;
  getUserBuyOrders(userId: string, status?: string): Promise<MarketplaceBuyOrderWithDetails[]>;
  
  // Matching
  processAutoMatch(saleId: string): Promise<void>;
  
  // History
  getMarketplaceHistory(userId: string, limit?: number, offset?: number): Promise<{
    sales: MarketplaceSaleWithDetails[];
    purchases: MarketplaceSaleWithDetails[];
    buyOrders: MarketplaceBuyOrderWithDetails[];
  }>;

  // Nouvelle méthode pour la recherche
  searchMarketplace(searchParams: MarketplaceSearchParams): Promise<MarketplaceSearchResult>;
}

export interface MarketplaceSearchParams {
  query?: string; // Recherche par nom d'item
  item_id?: string; // Filtrer par item spécifique
  min_price?: number;
  max_price?: number;
  seller_username?: string;
  has_metadata?: boolean; // Filtrer les items avec ou sans métadonnées
  sort_by?: 'price_asc' | 'price_desc' | 'date_asc' | 'date_desc' | 'name_asc' | 'name_desc';
  limit?: number;
  offset?: number;
}

export interface MarketplaceSearchResult {
  sales: MarketplaceSaleWithDetails[];
  total_count: number;
  filters_applied: {
    query?: string;
    item_id?: string;
    min_price?: number;
    max_price?: number;
    seller_username?: string;
    has_metadata?: boolean;
  };
}

@injectable()
export class MarketplaceService implements IMarketplaceService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("InventoryService") private inventoryService: IInventoryService,
    @inject("UserService") private userService: IUserService,
    @inject("ItemService") private itemService: IItemService
  ) {}

  async createSale(userId: string, saleData: CreateSaleRequest): Promise<MarketplaceSale> {
    // Vérifier que l'utilisateur possède l'item
    if (saleData.unique_id) {
      // Pour les items avec métadonnées, vérifier l'unique_id spécifique
      const {inventory} = await this.inventoryService.getInventory(userId);
      const hasItem = inventory.some(item => 
        item.item_id === saleData.item_id && 
        item.metadata?.unique_id === saleData.unique_id &&
        item.sellable
      );
      if (!hasItem) {
        throw new Error("Item not found in inventory or not sellable");
      }
    } else {
      // Pour les items normaux, vérifier qu'il en a au moins 1 sellable
      const hasSellableItem = await this.inventoryService.hasItemWithoutMetadataSellable(userId, saleData.item_id, 1);
      if (!hasSellableItem) {
        throw new Error("Insufficient sellable items in inventory");
      }
    }

    // Retirer l'item de l'inventaire
    if (saleData.unique_id) {
      await this.inventoryService.removeItemByUniqueId(userId, saleData.item_id, saleData.unique_id);
    } else {
      await this.inventoryService.removeSellableItem(userId, saleData.item_id, 1);
    }

    // Créer la vente
    const sale: MarketplaceSale = {
      id: uuidv4(),
      seller_user_id: userId,
      item_id: saleData.item_id,
      unique_id: saleData.unique_id,
      price: saleData.price,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    await this.databaseService.create(
      `INSERT INTO marketplace_sales (id, seller_user_id, item_id, unique_id, price, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sale.id, sale.seller_user_id, sale.item_id, sale.unique_id || null, sale.price, sale.status, sale.created_at]
    );

    // Essayer de matcher automatiquement avec des ordres d'achat
    await this.processAutoMatch(sale.id);

    return sale;
  }

  async cancelSale(saleId: string, userId: string): Promise<void> {
    const sale = await this.getSaleById(saleId);
    if (!sale) {
      throw new Error("Sale not found");
    }
    if (sale.seller_user_id !== userId) {
      throw new Error("Not authorized to cancel this sale");
    }
    if (sale.status !== 'active') {
      throw new Error("Cannot cancel non-active sale");
    }

    // Remettre l'item dans l'inventaire
    if (sale.unique_id) {
      // Pour les items avec métadonnées, récupérer les métadonnées de la base
      const inventoryItems = await this.databaseService.read<any[]>(
        `SELECT metadata, sellable, purchasePrice FROM inventories
         WHERE userId = ? AND itemId = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`,
        [sale.seller_user_id, sale.item_id, sale.unique_id]
      );
      
      if (inventoryItems.length > 0) {
        const metadata = inventoryItems[0].metadata ? JSON.parse(inventoryItems[0].metadata) : undefined;
        await this.inventoryService.addItem(
          sale.seller_user_id, 
          sale.item_id, 
          1, 
          metadata, 
          inventoryItems[0].sellable === 1,
          inventoryItems[0].purchasePrice
        );
      } else {
        await this.inventoryService.addItem(sale.seller_user_id, sale.item_id, 1, undefined, true);
      }
    } else {
      await this.inventoryService.addItem(sale.seller_user_id, sale.item_id, 1, undefined, true);
    }

    // Marquer la vente comme annulée
    await this.databaseService.update(
      "UPDATE marketplace_sales SET status = 'cancelled' WHERE id = ?",
      [saleId]
    );
  }

  async getSaleById(saleId: string): Promise<MarketplaceSaleWithDetails | null> {
    const sales = await this.databaseService.read<any[]>(
      `SELECT ms.*, i.name as item_name, i.description as item_description, i.iconHash as item_icon_hash,
              u1.username as seller_username, u2.username as buyer_username,
              inv.metadata
       FROM marketplace_sales ms
       LEFT JOIN items i ON ms.item_id = i.itemId
       LEFT JOIN users u1 ON ms.seller_user_id = u1.user_id
       LEFT JOIN users u2 ON ms.buyer_user_id = u2.user_id
       LEFT JOIN inventories inv ON JSON_EXTRACT(inv.metadata, '$._unique_id') = ms.unique_id 
                                   AND inv.user_id = ms.seller_user_id 
                                   AND inv.item_id = ms.item_id
       WHERE ms.id = ?`,
      [saleId]
    );

    if (sales.length === 0) return null;

    const sale = sales[0];
    return {
      ...sale,
      metadata: sale.metadata ? JSON.parse(sale.metadata) : undefined
    };
  }

  async getActiveSales(itemId?: string, limit = 50, offset = 0): Promise<MarketplaceSaleWithDetails[]> {
    let query = `
      SELECT ms.*, i.name as item_name, i.description as item_description, i.iconHash as item_icon_hash,
             u1.username as seller_username, u2.username as buyer_username,
             inv.metadata
      FROM marketplace_sales ms
      LEFT JOIN items i ON ms.item_id = i.itemId
      LEFT JOIN users u1 ON ms.seller_user_id = u1.user_id
      LEFT JOIN users u2 ON ms.buyer_user_id = u2.user_id
      LEFT JOIN inventories inv ON JSON_EXTRACT(inv.metadata, '$._unique_id') = ms.unique_id 
                                  AND inv.user_id = ms.seller_user_id 
                                  AND inv.item_id = ms.item_id
      WHERE ms.status = 'active'
    `;
    
    const params: any[] = [];
    
    if (itemId) {
      query += " AND ms.item_id = ?";
      params.push(itemId);
    }
    
    query += " ORDER BY ms.price ASC, ms.created_at ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const sales = await this.databaseService.read<any[]>(query, params);
    
    return sales.map((sale: { metadata: string; }) => ({
      ...sale,
      metadata: sale.metadata ? JSON.parse(sale.metadata) : undefined
    }));
  }

  async getUserSales(userId: string, status?: string): Promise<MarketplaceSaleWithDetails[]> {
    let query = `
      SELECT ms.*, i.name as item_name, i.description as item_description, i.iconHash as item_icon_hash,
             u1.username as seller_username, u2.username as buyer_username,
             inv.metadata
      FROM marketplace_sales ms
      LEFT JOIN items i ON ms.item_id = i.itemId
      LEFT JOIN users u1 ON ms.seller_user_id = u1.user_id
      LEFT JOIN users u2 ON ms.buyer_user_id = u2.user_id
      LEFT JOIN inventories inv ON JSON_EXTRACT(inv.metadata, '$._unique_id') = ms.unique_id 
                                  AND inv.user_id = ms.seller_user_id 
                                  AND inv.item_id = ms.item_id
      WHERE ms.seller_user_id = ?
    `;
    
    const params: any[] = [userId];
    
    if (status) {
      query += " AND ms.status = ?";
      params.push(status);
    }
    
    query += " ORDER BY ms.created_at DESC";

    const sales = await this.databaseService.read<any[]>(query, params);
    
    return sales.map((sale: { metadata: string; }) => ({
      ...sale,
      metadata: sale.metadata ? JSON.parse(sale.metadata) : undefined
    }));
  }

  async createBuyOrder(userId: string, orderData: CreateBuyOrderRequest): Promise<MarketplaceBuyOrder[]> {
    const quantity = orderData.quantity || 1;
    const orders: MarketplaceBuyOrder[] = [];

    // Vérifier que l'item existe
    const item = await this.itemService.getItem(orderData.item_id);
    if (!item) {
      throw new Error("Item not found");
    }

    // Créer le nombre d'ordres d'achat demandé
    for (let i = 0; i < quantity; i++) {
      const order: MarketplaceBuyOrder = {
        id: uuidv4(),
        buyer_user_id: userId,
        item_id: orderData.item_id,
        max_price: orderData.max_price,
        status: 'active',
        created_at: new Date().toISOString(),
      };

      await this.databaseService.create(
        `INSERT INTO marketplace_buy_orders (id, buyer_user_id, item_id, max_price, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [order.id, order.buyer_user_id, order.item_id, order.max_price, order.status, order.created_at]
      );

      orders.push(order);

      // Essayer de matcher immédiatement avec des ventes existantes
      await this.tryMatchBuyOrder(order.id);
    }

    return orders;
  }

  async cancelBuyOrder(orderId: string, userId: string): Promise<void> {
    const order = await this.getBuyOrderById(orderId);
    if (!order) {
      throw new Error("Buy order not found");
    }
    if (order.buyer_user_id !== userId) {
      throw new Error("Not authorized to cancel this buy order");
    }
    if (order.status !== 'active') {
      throw new Error("Cannot cancel non-active buy order");
    }

    await this.databaseService.update(
      "UPDATE marketplace_buy_orders SET status = 'cancelled' WHERE id = ?",
      [orderId]
    );
  }

  async getBuyOrderById(orderId: string): Promise<MarketplaceBuyOrderWithDetails | null> {
    const orders = await this.databaseService.read<any[]>(
      `SELECT mbo.*, i.name as item_name, i.description as item_description, i.iconHash as item_icon_hash,
              u.username as buyer_username
       FROM marketplace_buy_orders mbo
       LEFT JOIN items i ON mbo.item_id = i.itemId
       LEFT JOIN users u ON mbo.buyer_user_id = u.user_id
       WHERE mbo.id = ?`,
      [orderId]
    );

    return orders.length > 0 ? orders[0] : null;
  }

  async getActiveBuyOrders(itemId?: string, limit = 50, offset = 0): Promise<MarketplaceBuyOrderWithDetails[]> {
    let query = `
      SELECT mbo.*, i.name as item_name, i.description as item_description, i.iconHash as item_icon_hash,
             u.username as buyer_username
      FROM marketplace_buy_orders mbo
      LEFT JOIN items i ON mbo.item_id = i.itemId
      LEFT JOIN users u ON mbo.buyer_user_id = u.user_id
      WHERE mbo.status = 'active'
    `;
    
    const params: any[] = [];
    
    if (itemId) {
      query += " AND mbo.item_id = ?";
      params.push(itemId);
    }
    
    query += " ORDER BY mbo.max_price DESC, mbo.created_at ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return this.databaseService.read<MarketplaceBuyOrderWithDetails[]>(query, params);
  }

  async getUserBuyOrders(userId: string, status?: string): Promise<MarketplaceBuyOrderWithDetails[]> {
    let query = `
      SELECT mbo.*, i.name as item_name, i.description as item_description, i.iconHash as item_icon_hash,
             u.username as buyer_username
      FROM marketplace_buy_orders mbo
      LEFT JOIN items i ON mbo.item_id = i.itemId
      LEFT JOIN users u ON mbo.buyer_user_id = u.user_id
      WHERE mbo.buyer_user_id = ?
    `;
    
    const params: any[] = [userId];
    
    if (status) {
      query += " AND mbo.status = ?";
      params.push(status);
    }
    
    query += " ORDER BY mbo.created_at DESC";

    return this.databaseService.read<MarketplaceBuyOrderWithDetails[]>(query, params);
  }

  async processAutoMatch(saleId: string): Promise<void> {
    const sale = await this.getSaleById(saleId);
    if (!sale || sale.status !== 'active') return;

    // Trouver le meilleur ordre d'achat (prix le plus élevé, puis le plus ancien)
    const buyOrders = await this.databaseService.read<MarketplaceBuyOrder[]>(
      `SELECT * FROM marketplace_buy_orders 
       WHERE item_id = ? AND status = 'active' AND max_price >= ?
       ORDER BY max_price DESC, created_at ASC
       LIMIT 1`,
      [sale.item_id, sale.price]
    );

    if (buyOrders.length > 0) {
      await this.executeTrade(sale.id, buyOrders[0].id);
    }
  }

  private async tryMatchBuyOrder(orderId: string): Promise<void> {
    const order = await this.getBuyOrderById(orderId);
    if (!order || order.status !== 'active') return;

    // Trouver la meilleure vente (prix le plus bas, puis la plus ancienne)
    const sales = await this.databaseService.read<MarketplaceSale[]>(
      `SELECT * FROM marketplace_sales 
       WHERE item_id = ? AND status = 'active' AND price <= ?
       ORDER BY price ASC, created_at ASC
       LIMIT 1`,
      [order.item_id, order.max_price]
    );

    if (sales.length > 0) {
      await this.executeTrade(sales[0].id, order.id);
    }
  }

  private async executeTrade(saleId: string, buyOrderId: string): Promise<void> {
    const sale = await this.getSaleById(saleId);
    const buyOrder = await this.getBuyOrderById(buyOrderId);

    if (!sale || !buyOrder || sale.status !== 'active' || buyOrder.status !== 'active') {
      return;
    }

    const now = new Date().toISOString();
    const buyer = await this.userService.getUser(buyOrder.buyer_user_id);
    const seller = await this.userService.getUser(sale.seller_user_id);

    if (!buyer || !seller) {
      throw new Error("Buyer or seller not found");
    }

    // Vérifier que l'acheteur a assez de crédits
    if (buyer.balance < sale.price) {
      throw new Error("Buyer has insufficient balance");
    }

    // Transférer l'argent
    await this.userService.updateUserBalance(buyOrder.buyer_user_id, buyer.balance - sale.price);
    await this.userService.updateUserBalance(sale.seller_user_id, seller.balance + sale.price);

    // Transférer l'item à l'acheteur
    if (sale.unique_id) {
      // Pour les items avec métadonnées, récupérer les métadonnées originales
      const metadata = sale.metadata;
      await this.inventoryService.addItem(
        buyOrder.buyer_user_id, 
        sale.item_id, 
        1, 
        metadata, 
        true, 
        sale.price
      );
    } else {
      await this.inventoryService.addItem(buyOrder.buyer_user_id, sale.item_id, 1, undefined, true, sale.price);
    }

    // Mettre à jour la vente
    await this.databaseService.update(
      `UPDATE marketplace_sales 
       SET status = 'sold', sold_at = ?, buyer_user_id = ? 
       WHERE id = ?`,
      [now, buyOrder.buyer_user_id, saleId]
    );

    // Mettre à jour l'ordre d'achat
    await this.databaseService.update(
      `UPDATE marketplace_buy_orders 
       SET status = 'filled', filled_at = ?, sale_id = ? 
       WHERE id = ?`,
      [now, saleId, buyOrderId]
    );
  }

  async getMarketplaceHistory(userId: string, limit = 50, offset = 0): Promise<{
    sales: MarketplaceSaleWithDetails[];
    purchases: MarketplaceSaleWithDetails[];
    buyOrders: MarketplaceBuyOrderWithDetails[];
  }> {
    // Ventes de l'utilisateur
    const sales = await this.getUserSales(userId);

    // Achats de l'utilisateur
    const purchases = await this.databaseService.read<any[]>(
      `SELECT ms.*, i.name as item_name, i.description as item_description, i.iconHash as item_icon_hash,
              u1.username as seller_username, u2.username as buyer_username,
              inv.metadata
       FROM marketplace_sales ms
       LEFT JOIN items i ON ms.item_id = i.itemId
       LEFT JOIN users u1 ON ms.seller_user_id = u1.user_id
       LEFT JOIN users u2 ON ms.buyer_user_id = u2.user_id
       LEFT JOIN inventories inv ON JSON_EXTRACT(inv.metadata, '$._unique_id') = ms.unique_id 
                                   AND inv.user_id = ms.seller_user_id 
                                   AND inv.item_id = ms.item_id
       WHERE ms.buyer_user_id = ?
       ORDER BY ms.sold_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    // Ordres d'achat de l'utilisateur
    const buyOrders = await this.getUserBuyOrders(userId);

    return {
      sales,
      purchases: purchases.map((purchase: { metadata: string; }) => ({
        ...purchase,
        metadata: purchase.metadata ? JSON.parse(purchase.metadata) : undefined
      })),
      buyOrders
    };
  }

  async searchMarketplace(searchParams: MarketplaceSearchParams): Promise<MarketplaceSearchResult> {
    const {
      query,
      item_id,
      min_price,
      max_price,
      seller_username,
      has_metadata,
      sort_by = 'price_asc',
      limit = 50,
      offset = 0
    } = searchParams;

    let baseQuery = `
      SELECT ms.*, i.name as item_name, i.description as item_description, i.iconHash as item_icon_hash,
             u1.username as seller_username, u2.username as buyer_username,
             inv.metadata
      FROM marketplace_sales ms
      LEFT JOIN items i ON ms.item_id = i.itemId
      LEFT JOIN users u1 ON ms.seller_user_id = u1.user_id
      LEFT JOIN users u2 ON ms.buyer_user_id = u2.user_id
      LEFT JOIN inventories inv ON JSON_EXTRACT(inv.metadata, '$._unique_id') = ms.unique_id 
                                  AND inv.user_id = ms.seller_user_id 
                                  AND inv.item_id = ms.item_id
      WHERE ms.status = 'active'
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM marketplace_sales ms
      LEFT JOIN items i ON ms.item_id = i.itemId
      LEFT JOIN users u1 ON ms.seller_user_id = u1.user_id
      LEFT JOIN inventories inv ON JSON_EXTRACT(inv.metadata, '$._unique_id') = ms.unique_id 
                                  AND inv.user_id = ms.seller_user_id 
                                  AND inv.item_id = ms.item_id
      WHERE ms.status = 'active'
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    // Recherche par nom d'item
    if (query) {
      conditions.push("i.name LIKE ?");
      params.push(`%${query}%`);
    }

    // Filtrer par item spécifique
    if (item_id) {
      conditions.push("ms.item_id = ?");
      params.push(item_id);
    }

    // Filtrer par prix minimum
    if (min_price !== undefined) {
      conditions.push("ms.price >= ?");
      params.push(min_price);
    }

    // Filtrer par prix maximum
    if (max_price !== undefined) {
      conditions.push("ms.price <= ?");
      params.push(max_price);
    }

    // Filtrer par nom de vendeur
    if (seller_username) {
      conditions.push("u1.username LIKE ?");
      params.push(`%${seller_username}%`);
    }

    // Filtrer par présence de métadonnées
    if (has_metadata !== undefined) {
      if (has_metadata) {
        conditions.push("ms.unique_id IS NOT NULL");
      } else {
        conditions.push("ms.unique_id IS NULL");
      }
    }

    // Ajouter les conditions à la requête
    if (conditions.length > 0) {
      const conditionString = " AND " + conditions.join(" AND ");
      baseQuery += conditionString;
      countQuery += conditionString;
    }

    // Obtenir le nombre total d'éléments
    const countResult = await this.databaseService.read<any[]>(countQuery, params);
    const totalCount = countResult[0]?.total || 0;

    // Ajouter le tri
    let orderBy = "";
    switch (sort_by) {
      case 'price_asc':
        orderBy = "ORDER BY ms.price ASC";
        break;
      case 'price_desc':
        orderBy = "ORDER BY ms.price DESC";
        break;
      case 'date_asc':
        orderBy = "ORDER BY ms.created_at ASC";
        break;
      case 'date_desc':
        orderBy = "ORDER BY ms.created_at DESC";
        break;
      case 'name_asc':
        orderBy = "ORDER BY i.name ASC";
        break;
      case 'name_desc':
        orderBy = "ORDER BY i.name DESC";
        break;
      default:
        orderBy = "ORDER BY ms.price ASC, ms.created_at ASC";
    }

    baseQuery += ` ${orderBy} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const sales = await this.databaseService.read<any[]>(baseQuery, params);

    return {
      sales: sales.map((sale: any) => ({
        ...sale,
        metadata: sale.metadata ? JSON.parse(sale.metadata) : undefined
      })),
      total_count: totalCount,
      filters_applied: {
        query,
        item_id,
        min_price,
        max_price,
        seller_username,
        has_metadata
      }
    };
  }
}