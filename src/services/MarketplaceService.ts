/* eslint-disable @typescript-eslint/no-explicit-any */
import { injectable, inject } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { IInventoryService } from "./InventoryService";
import { IUserService } from "./UserService";
import { MarketplaceSale, MarketplaceBuyOrder, MarketplaceTransaction } from "../interfaces/Marketplace";
import { v4 as uuidv4 } from "uuid";

export interface IMarketplaceService {
  createSale(sellerUserId: string, itemId: string, uniqueId: string | undefined, price: number): Promise<string>;
  cancelSale(saleId: string, userId: string): Promise<void>;
  createBuyOrder(buyerUserId: string, itemId: string, maxPrice: number): Promise<string>;
  cancelBuyOrder(orderId: string, userId: string): Promise<void>;
  getSalesByUser(userId: string): Promise<MarketplaceSale[]>;
  getBuyOrdersByUser(userId: string): Promise<MarketplaceBuyOrder[]>;
  getActiveSalesForItem(itemId: string): Promise<MarketplaceSale[]>;
  getActiveBuyOrdersForItem(itemId: string): Promise<MarketplaceBuyOrder[]>;
  getMarketplaceHistory(userId: string): Promise<MarketplaceTransaction[]>;
  searchAllItems(query: string): Promise<any[]>;
  getUserSellableItems(userId: string): Promise<any[]>;
  // Ancienne méthode pour compatibilité
  searchItems(query: string): Promise<any[]>;
}

@injectable()
export class MarketplaceService implements IMarketplaceService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("InventoryService") private inventoryService: IInventoryService,
    @inject("UserService") private userService: IUserService
  ) {}

  async createSale(sellerUserId: string, itemId: string, uniqueId: string | undefined, price: number): Promise<string> {
    // Vérifier que l'utilisateur possède l'item
    if (uniqueId) {
      // Item avec métadonnées
      const inventory = await this.inventoryService.getInventory(sellerUserId);
      const hasItem = inventory.inventory.some(
        item => item.item_id === itemId && item.metadata?._unique_id === uniqueId
      );
      if (!hasItem) {
        throw new Error("You don't own this specific item");
      }
    } else {
      // Item sans métadonnées - vérifier les items sellable
      const hasItem = await this.inventoryService.hasItemWithoutMetadataSellable(sellerUserId, itemId, 1);
      if (!hasItem) {
        throw new Error("You don't own this item or it's not sellable");
      }
    }

    // Retirer l'item de l'inventaire temporairement (il sera en "escrow")
    if (uniqueId) {
      await this.inventoryService.removeItemByUniqueId(sellerUserId, itemId, uniqueId);
    } else {
      await this.inventoryService.removeSellableItem(sellerUserId, itemId, 1);
    }

    const saleId = uuidv4();
    await this.databaseService.create(
      `INSERT INTO marketplace_sales (id, seller_user_id, item_id, unique_id, price, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [saleId, sellerUserId, itemId, uniqueId || null, price, new Date().toISOString()]
    );

    // Vérifier s'il y a des ordres d'achat correspondants
    await this.matchSaleWithBuyOrders(saleId);

    return saleId;
  }

  async cancelSale(saleId: string, userId: string): Promise<void> {
    const sales = await this.databaseService.read<MarketplaceSale[]>(
      "SELECT * FROM marketplace_sales WHERE id = ? AND seller_user_id = ? AND status = 'active'",
      [saleId, userId]
    );

    if (sales.length === 0) {
      throw new Error("Sale not found or not yours");
    }

    const sale = sales[0];

    // Remettre l'item dans l'inventaire
    if (sale.uniqueId) {
      // Reconstituer les métadonnées depuis l'inventaire original
      await this.inventoryService.addItem(userId, sale.itemId, 1, { _unique_id: sale.uniqueId }, false);
    } else {
      await this.inventoryService.addItem(userId, sale.itemId, 1, undefined, true);
    }

    await this.databaseService.update(
      "UPDATE marketplace_sales SET status = 'cancelled' WHERE id = ?",
      [saleId]
    );
  }

  async createBuyOrder(buyerUserId: string, itemId: string, maxPrice: number): Promise<string> {
    // Vérifier que l'utilisateur a assez de crédits
    const user = await this.userService.getUser(buyerUserId);
    if (!user || user.balance < maxPrice) {
      throw new Error("Insufficient balance");
    }

    // Retirer les crédits temporairement (escrow)
    await this.userService.updateUserBalance(buyerUserId, user.balance - maxPrice);

    const orderId = uuidv4();
    await this.databaseService.create(
      `INSERT INTO marketplace_buy_orders (id, buyer_user_id, item_id, max_price, status, created_at)
       VALUES (?, ?, ?, ?, 'active', ?)`,
      [orderId, buyerUserId, itemId, maxPrice, new Date().toISOString()]
    );

    // Vérifier s'il y a des ventes correspondantes
    await this.matchBuyOrderWithSales(orderId);

    return orderId;
  }

  async cancelBuyOrder(orderId: string, userId: string): Promise<void> {
    const orders = await this.databaseService.read<MarketplaceBuyOrder[]>(
      "SELECT * FROM marketplace_buy_orders WHERE id = ? AND buyer_user_id = ? AND status = 'active'",
      [orderId, userId]
    );

    if (orders.length === 0) {
      throw new Error("Buy order not found or not yours");
    }

    const order = orders[0];

    // Remettre les crédits dans le compte
    const user = await this.userService.getUser(userId);
    if (user) {
      await this.userService.updateUserBalance(userId, user.balance + order.maxPrice);
    }

    await this.databaseService.update(
      "UPDATE marketplace_buy_orders SET status = 'cancelled' WHERE id = ?",
      [orderId]
    );
  }

  private async matchSaleWithBuyOrders(saleId: string): Promise<void> {
    const sales = await this.databaseService.read<MarketplaceSale[]>(
      "SELECT * FROM marketplace_sales WHERE id = ? AND status = 'active'",
      [saleId]
    );

    if (sales.length === 0) return;
    const sale = sales[0];

    // Trouver le meilleur ordre d'achat (prix le plus élevé, puis premier créé)
    const buyOrders = await this.databaseService.read<MarketplaceBuyOrder[]>(
      `SELECT * FROM marketplace_buy_orders 
       WHERE item_id = ? AND max_price >= ? AND status = 'active'
       ORDER BY max_price DESC, created_at ASC 
       LIMIT 1`,
      [sale.itemId, sale.price]
    );

    if (buyOrders.length > 0) {
      await this.executeTrade(sale, buyOrders[0]);
    }
  }

  private async matchBuyOrderWithSales(orderId: string): Promise<void> {
    const orders = await this.databaseService.read<MarketplaceBuyOrder[]>(
      "SELECT * FROM marketplace_buy_orders WHERE id = ? AND status = 'active'",
      [orderId]
    );

    if (orders.length === 0) return;
    const order = orders[0];

    // Trouver la meilleure vente (prix le plus bas, puis première créée)
    const sales = await this.databaseService.read<MarketplaceSale[]>(
      `SELECT * FROM marketplace_sales 
       WHERE item_id = ? AND price <= ? AND status = 'active'
       ORDER BY price ASC, created_at ASC 
       LIMIT 1`,
      [order.itemId, order.maxPrice]
    );

    if (sales.length > 0) {
      await this.executeTrade(sales[0], order);
    }
  }

  private async executeTrade(sale: MarketplaceSale, buyOrder: MarketplaceBuyOrder): Promise<void> {
    const now = new Date().toISOString();

    // Transférer l'item à l'acheteur
    if (sale.uniqueId) {
      await this.inventoryService.addItem(buyOrder.buyerUserId, sale.itemId, 1, { _unique_id: sale.uniqueId }, false);
    } else {
      await this.inventoryService.addItem(buyOrder.buyerUserId, sale.itemId, 1, undefined, true, sale.price);
    }

    // Calculer la différence de prix à rembourser à l'acheteur
    const priceDifference = buyOrder.maxPrice - sale.price;
    
    // Transférer l'argent au vendeur
    const seller = await this.userService.getUser(sale.sellerUserId);
    const buyer = await this.userService.getUser(buyOrder.buyerUserId);
    
    if (!seller || !buyer) {
      throw new Error("User not found");
    }

    // Le vendeur reçoit le prix de la vente
    await this.userService.updateUserBalance(seller.user_id, seller.balance + sale.price);
    
    // L'acheteur récupère la différence si son ordre était supérieur au prix de vente
    if (priceDifference > 0) {
      await this.userService.updateUserBalance(buyer.user_id, buyer.balance + priceDifference);
    }

    // Marquer la vente et l'ordre comme complétés
    await this.databaseService.update(
      "UPDATE marketplace_sales SET status = 'sold', sold_at = ?, buyer_user_id = ? WHERE id = ?",
      [now, buyOrder.buyerUserId, sale.id]
    );

    await this.databaseService.update(
      "UPDATE marketplace_buy_orders SET status = 'filled', filled_at = ?, sale_id = ? WHERE id = ?",
      [now, sale.id, buyOrder.id]
    );
  }

  async getSalesByUser(userId: string): Promise<MarketplaceSale[]> {
    return this.databaseService.read<MarketplaceSale[]>(
      `SELECT ms.*, i.name as itemName, i.iconHash, i.description
       FROM marketplace_sales ms
       JOIN items i ON ms.item_id = i.itemId
       WHERE ms.seller_user_id = ?
       ORDER BY ms.created_at DESC`,
      [userId]
    );
  }

  async getBuyOrdersByUser(userId: string): Promise<MarketplaceBuyOrder[]> {
    return this.databaseService.read<MarketplaceBuyOrder[]>(
      `SELECT mbo.*, i.name as itemName, i.iconHash, i.description
       FROM marketplace_buy_orders mbo
       JOIN items i ON mbo.item_id = i.itemId
       WHERE mbo.buyer_user_id = ?
       ORDER BY mbo.created_at DESC`,
      [userId]
    );
  }

  async getActiveSalesForItem(itemId: string): Promise<MarketplaceSale[]> {
    return this.databaseService.read<MarketplaceSale[]>(
      `SELECT ms.*, u.username as sellerUsername
       FROM marketplace_sales ms
       JOIN users u ON ms.seller_user_id = u.user_id
       WHERE ms.item_id = ? AND ms.status = 'active'
       ORDER BY ms.price ASC, ms.created_at ASC`,
      [itemId]
    );
  }

  async getActiveBuyOrdersForItem(itemId: string): Promise<MarketplaceBuyOrder[]> {
    return this.databaseService.read<MarketplaceBuyOrder[]>(
      `SELECT mbo.*, u.username as buyerUsername
       FROM marketplace_buy_orders mbo
       JOIN users u ON mbo.buyer_user_id = u.user_id
       WHERE mbo.item_id = ? AND mbo.status = 'active'
       ORDER BY mbo.max_price DESC, mbo.created_at ASC`,
      [itemId]
    );
  }

  async getMarketplaceHistory(userId: string): Promise<MarketplaceTransaction[]> {
    return this.databaseService.read<MarketplaceTransaction[]>(
      `SELECT ms.id as saleId, mbo.id as buyOrderId, ms.seller_user_id as sellerUserId, 
              mbo.buyer_user_id as buyerUserId, ms.item_id as itemId, ms.unique_id as uniqueId, 
              ms.price, ms.sold_at as completedAt,
              i.name as itemName, i.iconHash, i.description,
              seller.username as sellerUsername, buyer.username as buyerUsername
       FROM marketplace_sales ms
       JOIN marketplace_buy_orders mbo ON ms.id = mbo.sale_id
       JOIN items i ON ms.item_id = i.itemId
       JOIN users seller ON ms.seller_user_id = seller.user_id
       JOIN users buyer ON mbo.buyer_user_id = buyer.user_id
       WHERE (ms.seller_user_id = ? OR mbo.buyer_user_id = ?) AND ms.status = 'sold'
       ORDER BY ms.sold_at DESC`,
      [userId, userId]
    );
  }

  // Nouvelle méthode : rechercher tous les items du jeu
  async searchAllItems(query: string): Promise<any[]> {
    const items = await this.databaseService.read<any[]>(
      `SELECT itemId, name, description, iconHash, price 
       FROM items 
       WHERE (deleted IS NULL OR deleted = 0) 
       AND (name LIKE ? OR description LIKE ?)
       ORDER BY name ASC
       LIMIT 50`,
      [`%${query}%`, `%${query}%`]
    );
    
    return items;
  }

  // Nouvelle méthode : obtenir les items vendables de l'utilisateur
  async getUserSellableItems(userId: string): Promise<any[]> {
    const items = await this.databaseService.read<any[]>(
      `SELECT DISTINCT 
         inv.item_id as itemId,
         i.name,
         i.description,
         i.iconHash,
         i.price,
         SUM(CASE WHEN inv.sellable = 1 THEN inv.amount ELSE 0 END) as sellableAmount,
         COUNT(CASE WHEN inv.metadata IS NOT NULL THEN 1 END) as itemsWithMetadata
       FROM inventories inv
       INNER JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
       WHERE inv.user_id = ? 
       AND (inv.sellable = 1 OR inv.metadata IS NOT NULL)
       AND inv.amount > 0
       GROUP BY inv.item_id, i.name, i.description, i.iconHash, i.price
       HAVING sellableAmount > 0 OR itemsWithMetadata > 0
       ORDER BY i.name ASC`,
      [userId]
    );
    
    return items;
  }

  // Ancienne méthode gardée pour compatibilité
  async searchItems(query: string): Promise<any[]> {
    return this.searchAllItems(query);
  }
}