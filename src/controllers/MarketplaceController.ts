import { Request, Response } from "express";
import { controller, httpGet, httpPost, httpDelete } from "inversify-express-utils";
import { inject } from "inversify";
import { IMarketplaceService } from "../services/MarketplaceService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { LoggedCheck } from "../middlewares/LoggedCheck";
import { describe } from "../decorators/describe";

@controller("/marketplace")
export class MarketplaceController {
  constructor(
    @inject("MarketplaceService") private marketplaceService: IMarketplaceService
  ) {}

  @describe({
    endpoint: "/marketplace/sell",
    method: "POST",
    description: "Put an item for sale in the marketplace",
    body: {
      itemId: "The ID of the item to sell",
      uniqueId: "The unique ID for items with metadata (optional)",
      price: "The selling price"
    },
    responseType: { saleId: "string", message: "string" },
    requiresAuth: true,
  })
  @httpPost("/sell", LoggedCheck.middleware)
  public async createSale(req: AuthenticatedRequest, res: Response) {
    const { itemId, uniqueId, price } = req.body;
    
    if (!itemId || !price || price <= 0) {
      return res.status(400).json({ message: "Invalid input" });
    }

    try {
      const saleId = await this.marketplaceService.createSale(
        req.user!.user_id,
        itemId,
        uniqueId,
        price
      );
      
      res.status(200).json({ saleId, message: "Item put up for sale" });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(400).json({ message: errorMsg });
    }
  }

  @describe({
    endpoint: "/marketplace/buy-order",
    method: "POST",
    description: "Create a buy order for an item",
    body: {
      itemId: "The ID of the item to buy",
      maxPrice: "The maximum price willing to pay"
    },
    responseType: { orderId: "string", message: "string" },
    requiresAuth: true,
  })
  @httpPost("/buy-order", LoggedCheck.middleware)
  public async createBuyOrder(req: AuthenticatedRequest, res: Response) {
    const { itemId, maxPrice } = req.body;
    
    if (!itemId || !maxPrice || maxPrice <= 0) {
      return res.status(400).json({ message: "Invalid input" });
    }

    try {
      const orderId = await this.marketplaceService.createBuyOrder(
        req.user!.user_id,
        itemId,
        maxPrice
      );
      
      res.status(200).json({ orderId, message: "Buy order created" });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(400).json({ message: errorMsg });
    }
  }

  @describe({
    endpoint: "/marketplace/sales/:saleId",
    method: "DELETE",
    description: "Cancel a sale",
    params: { saleId: "The ID of the sale to cancel" },
    requiresAuth: true,
  })
  @httpDelete("/sales/:saleId", LoggedCheck.middleware)
  public async cancelSale(req: AuthenticatedRequest, res: Response) {
    try {
      await this.marketplaceService.cancelSale(req.params.saleId, req.user!.user_id);
      res.status(200).json({ message: "Sale cancelled" });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(400).json({ message: errorMsg });
    }
  }

  @describe({
    endpoint: "/marketplace/buy-orders/:orderId",
    method: "DELETE",
    description: "Cancel a buy order",
    params: { orderId: "The ID of the buy order to cancel" },
    requiresAuth: true,
  })
  @httpDelete("/buy-orders/:orderId", LoggedCheck.middleware)
  public async cancelBuyOrder(req: AuthenticatedRequest, res: Response) {
    try {
      await this.marketplaceService.cancelBuyOrder(req.params.orderId, req.user!.user_id);
      res.status(200).json({ message: "Buy order cancelled" });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(400).json({ message: errorMsg });
    }
  }

  @describe({
    endpoint: "/marketplace/my-sales",
    method: "GET",
    description: "Get user's sales",
    requiresAuth: true,
  })
  @httpGet("/my-sales", LoggedCheck.middleware)
  public async getMySales(req: AuthenticatedRequest, res: Response) {
    try {
      const sales = await this.marketplaceService.getSalesByUser(req.user!.user_id);
      res.status(200).json(sales);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: errorMsg });
    }
  }

  @describe({
    endpoint: "/marketplace/my-buy-orders",
    method: "GET",
    description: "Get user's buy orders",
    requiresAuth: true,
  })
  @httpGet("/my-buy-orders", LoggedCheck.middleware)
  public async getMyBuyOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const orders = await this.marketplaceService.getBuyOrdersByUser(req.user!.user_id);
      res.status(200).json(orders);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: errorMsg });
    }
  }

  @describe({
    endpoint: "/marketplace/item/:itemId",
    method: "GET",
    description: "Get marketplace data for a specific item",
    params: { itemId: "The ID of the item" },
  })
  @httpGet("/item/:itemId")
  public async getItemMarketplace(req: Request, res: Response) {
    try {
      const { itemId } = req.params;
      const [sales, buyOrders] = await Promise.all([
        this.marketplaceService.getActiveSalesForItem(itemId),
        this.marketplaceService.getActiveBuyOrdersForItem(itemId)
      ]);
      
      res.status(200).json({ sales, buyOrders });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: errorMsg });
    }
  }

  @describe({
    endpoint: "/marketplace/history",
    method: "GET",
    description: "Get user's marketplace transaction history",
    requiresAuth: true,
  })
  @httpGet("/history", LoggedCheck.middleware)
  public async getHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const history = await this.marketplaceService.getMarketplaceHistory(req.user!.user_id);
      res.status(200).json(history);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: errorMsg });
    }
  }

  @describe({
    endpoint: "/marketplace/search",
    method: "GET",
    description: "Search all available items in the game for marketplace",
    query: { q: "Search query" },
  })
  @httpGet("/search")
  public async searchItems(req: Request, res: Response) {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Search query required" });
      }
      
      // Rechercher dans tous les items du jeu, pas dans l'inventaire de l'utilisateur
      const items = await this.marketplaceService.searchAllItems(q);
      res.status(200).json(items);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: errorMsg });
    }
  }

  @describe({
    endpoint: "/marketplace/my-sellable-items",
    method: "GET",
    description: "Get user's sellable items from inventory",
    requiresAuth: true,
  })
  @httpGet("/my-sellable-items", LoggedCheck.middleware)
  public async getMySellableItems(req: AuthenticatedRequest, res: Response) {
    try {
      // Cette méthode retourne les items vendables de l'inventaire de l'utilisateur
      const items = await this.marketplaceService.getUserSellableItems(req.user!.user_id);
      res.status(200).json(items);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: errorMsg });
    }
  }
}