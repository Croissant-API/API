"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const inversify_1 = require("inversify");
const uuid_1 = require("uuid");
let MarketplaceService = class MarketplaceService {
    constructor(databaseService, inventoryService, userService, itemService) {
        this.databaseService = databaseService;
        this.inventoryService = inventoryService;
        this.userService = userService;
        this.itemService = itemService;
    }
    async createSale(sellerUserId, itemId, uniqueId, price) {
        // Vérifier que l'utilisateur possède l'item
        if (uniqueId) {
            // Item avec métadonnées
            const inventory = await this.inventoryService.getInventory(sellerUserId);
            const hasItem = inventory.inventory.some(item => item.item_id === itemId && item.metadata?._unique_id === uniqueId);
            if (!hasItem) {
                throw new Error("You don't own this specific item");
            }
        }
        else {
            // Item sans métadonnées - vérifier les items sellable
            const hasItem = await this.inventoryService.hasItemWithoutMetadataSellable(sellerUserId, itemId, 1);
            if (!hasItem) {
                throw new Error("You don't own this item or it's not sellable");
            }
        }
        // Retirer l'item de l'inventaire temporairement (il sera en "escrow")
        if (uniqueId) {
            await this.inventoryService.removeItemByUniqueId(sellerUserId, itemId, uniqueId);
        }
        else {
            await this.inventoryService.removeSellableItem(sellerUserId, itemId, 1);
        }
        const saleId = (0, uuid_1.v4)();
        await this.databaseService.create(`INSERT INTO marketplace_sales (id, seller_user_id, item_id, unique_id, price, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`, [saleId, sellerUserId, itemId, uniqueId || null, price, new Date().toISOString()]);
        // Vérifier s'il y a des ordres d'achat correspondants
        await this.matchSaleWithBuyOrders(saleId);
        return saleId;
    }
    async cancelSale(saleId, userId) {
        const sales = await this.databaseService.read("SELECT * FROM marketplace_sales WHERE id = ? AND seller_user_id = ? AND status = 'active'", [saleId, userId]);
        if (sales.length === 0) {
            throw new Error("Sale not found or not yours");
        }
        const sale = sales[0];
        // Remettre l'item dans l'inventaire
        if (sale.uniqueId) {
            // Reconstituer les métadonnées depuis l'inventaire original
            await this.inventoryService.addItem(userId, sale.itemId, 1, { _unique_id: sale.uniqueId }, false);
        }
        else {
            await this.inventoryService.addItem(userId, sale.itemId, 1, undefined, true);
        }
        await this.databaseService.update("UPDATE marketplace_sales SET status = 'cancelled' WHERE id = ?", [saleId]);
    }
    async createBuyOrder(buyerUserId, itemId, maxPrice) {
        // Vérifier que l'utilisateur a assez de crédits
        const user = await this.userService.getUser(buyerUserId);
        if (!user || user.balance < maxPrice) {
            throw new Error("Insufficient balance");
        }
        // Retirer les crédits temporairement (escrow)
        await this.userService.updateUserBalance(buyerUserId, user.balance - maxPrice);
        const orderId = (0, uuid_1.v4)();
        await this.databaseService.create(`INSERT INTO marketplace_buy_orders (id, buyer_user_id, item_id, max_price, status, created_at)
       VALUES (?, ?, ?, ?, 'active', ?)`, [orderId, buyerUserId, itemId, maxPrice, new Date().toISOString()]);
        // Vérifier s'il y a des ventes correspondantes
        await this.matchBuyOrderWithSales(orderId);
        return orderId;
    }
    async cancelBuyOrder(orderId, userId) {
        const orders = await this.databaseService.read("SELECT * FROM marketplace_buy_orders WHERE id = ? AND buyer_user_id = ? AND status = 'active'", [orderId, userId]);
        if (orders.length === 0) {
            throw new Error("Buy order not found or not yours");
        }
        const order = orders[0];
        // Remettre les crédits dans le compte
        const user = await this.userService.getUser(userId);
        if (user) {
            await this.userService.updateUserBalance(userId, user.balance + order.maxPrice);
        }
        await this.databaseService.update("UPDATE marketplace_buy_orders SET status = 'cancelled' WHERE id = ?", [orderId]);
    }
    async matchSaleWithBuyOrders(saleId) {
        const sales = await this.databaseService.read("SELECT * FROM marketplace_sales WHERE id = ? AND status = 'active'", [saleId]);
        if (sales.length === 0)
            return;
        const sale = sales[0];
        // Trouver le meilleur ordre d'achat (prix le plus élevé, puis premier créé)
        const buyOrders = await this.databaseService.read(`SELECT * FROM marketplace_buy_orders 
       WHERE item_id = ? AND max_price >= ? AND status = 'active'
       ORDER BY max_price DESC, created_at ASC 
       LIMIT 1`, [sale.itemId, sale.price]);
        if (buyOrders.length > 0) {
            await this.executeTrade(sale, buyOrders[0]);
        }
    }
    async matchBuyOrderWithSales(orderId) {
        const orders = await this.databaseService.read("SELECT * FROM marketplace_buy_orders WHERE id = ? AND status = 'active'", [orderId]);
        if (orders.length === 0)
            return;
        const order = orders[0];
        // Trouver la meilleure vente (prix le plus bas, puis première créée)
        const sales = await this.databaseService.read(`SELECT * FROM marketplace_sales 
       WHERE item_id = ? AND price <= ? AND status = 'active'
       ORDER BY price ASC, created_at ASC 
       LIMIT 1`, [order.itemId, order.maxPrice]);
        if (sales.length > 0) {
            await this.executeTrade(sales[0], order);
        }
    }
    async executeTrade(sale, buyOrder) {
        const now = new Date().toISOString();
        // Transférer l'item à l'acheteur
        if (sale.uniqueId) {
            await this.inventoryService.addItem(buyOrder.buyerUserId, sale.itemId, 1, { _unique_id: sale.uniqueId }, false);
        }
        else {
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
        await this.databaseService.update("UPDATE marketplace_sales SET status = 'sold', sold_at = ?, buyer_user_id = ? WHERE id = ?", [now, buyOrder.buyerUserId, sale.id]);
        await this.databaseService.update("UPDATE marketplace_buy_orders SET status = 'filled', filled_at = ?, sale_id = ? WHERE id = ?", [now, sale.id, buyOrder.id]);
    }
    async getSalesByUser(userId) {
        return this.databaseService.read(`SELECT ms.*, i.name as itemName, i.iconHash, i.description, i.rarity
       FROM marketplace_sales ms
       JOIN items i ON ms.item_id = i.itemId
       WHERE ms.seller_user_id = ?
       ORDER BY ms.created_at DESC`, [userId]);
    }
    async getBuyOrdersByUser(userId) {
        return this.databaseService.read(`SELECT mbo.*, i.name as itemName, i.iconHash, i.description, i.rarity
       FROM marketplace_buy_orders mbo
       JOIN items i ON mbo.item_id = i.itemId
       WHERE mbo.buyer_user_id = ?
       ORDER BY mbo.created_at DESC`, [userId]);
    }
    async getActiveSalesForItem(itemId) {
        return this.databaseService.read(`SELECT ms.*, u.username as sellerUsername
       FROM marketplace_sales ms
       JOIN users u ON ms.seller_user_id = u.user_id
       WHERE ms.item_id = ? AND ms.status = 'active'
       ORDER BY ms.price ASC, ms.created_at ASC`, [itemId]);
    }
    async getActiveBuyOrdersForItem(itemId) {
        return this.databaseService.read(`SELECT mbo.*, u.username as buyerUsername
       FROM marketplace_buy_orders mbo
       JOIN users u ON mbo.buyer_user_id = u.user_id
       WHERE mbo.item_id = ? AND mbo.status = 'active'
       ORDER BY mbo.max_price DESC, mbo.created_at ASC`, [itemId]);
    }
    async getMarketplaceHistory(userId) {
        return this.databaseService.read(`SELECT ms.id as saleId, mbo.id as buyOrderId, ms.seller_user_id as sellerUserId, 
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
       ORDER BY ms.sold_at DESC`, [userId, userId]);
    }
    // Nouvelle méthode : rechercher tous les items du jeu
    async searchAllItems(query) {
        const items = await this.databaseService.read(`SELECT itemId, name, description, iconHash, price, rarity 
       FROM items 
       WHERE (deleted IS NULL OR deleted = 0) 
       AND (name LIKE ? OR description LIKE ?)
       ORDER BY name ASC
       LIMIT 50`, [`%${query}%`, `%${query}%`]);
        return items;
    }
    // Nouvelle méthode : obtenir les items vendables de l'utilisateur
    async getUserSellableItems(userId) {
        const items = await this.databaseService.read(`SELECT DISTINCT 
         inv.item_id as itemId,
         i.name,
         i.description,
         i.iconHash,
         i.price,
         i.rarity,
         SUM(CASE WHEN inv.sellable = 1 THEN inv.amount ELSE 0 END) as sellableAmount,
         COUNT(CASE WHEN inv.metadata IS NOT NULL THEN 1 END) as itemsWithMetadata
       FROM inventories inv
       INNER JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
       WHERE inv.user_id = ? 
       AND (inv.sellable = 1 OR inv.metadata IS NOT NULL)
       AND inv.amount > 0
       GROUP BY inv.item_id, i.name, i.description, i.iconHash, i.price, i.rarity
       HAVING sellableAmount > 0 OR itemsWithMetadata > 0
       ORDER BY i.name ASC`, [userId]);
        return items;
    }
    // Ancienne méthode gardée pour compatibilité
    async searchItems(query) {
        return this.searchAllItems(query);
    }
};
MarketplaceService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __param(1, (0, inversify_1.inject)("InventoryService")),
    __param(2, (0, inversify_1.inject)("UserService")),
    __param(3, (0, inversify_1.inject)("ItemService")),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], MarketplaceService);
exports.MarketplaceService = MarketplaceService;
