/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpGet, httpPost, httpDelete } from "inversify-express-utils";
import { IMarketplaceService } from "../services/MarketplaceService";
import { ILogService } from "../services/LogService";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { describe } from "../decorators/describe";
import { ValidationError, Schema } from "yup";
import * as yup from "yup";
import { IDatabaseService } from "../services/DatabaseService";

function handleError(res: Response, error: unknown, message: string, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}

async function validateOr400(schema: Schema<unknown>, data: unknown, res: Response) {
    try {
        await schema.validate(data);
        return true;
    } catch (error) {
        if (error instanceof ValidationError) {
            res.status(400).send({
                message: "Validation failed",
                errors: error.errors,
            });
            return false;
        }
        throw error;
    }
}

const createSaleSchema = yup.object({
    item_id: yup.string().required(),
    unique_id: yup.string().optional(),
    price: yup.number().positive().required(),
});

const createBuyOrderSchema = yup.object({
    item_id: yup.string().required(),
    max_price: yup.number().positive().required(),
    quantity: yup.number().integer().min(1).max(100).optional(),
});

const searchMarketplaceSchema = yup.object({
  query: yup.string().optional(),
  item_id: yup.string().optional(),
  min_price: yup.number().min(0).optional(),
  max_price: yup.number().min(0).optional(),
  seller_username: yup.string().optional(),
  has_metadata: yup.boolean().optional(),
  sort_by: yup.string().oneOf(['price_asc', 'price_desc', 'date_asc', 'date_desc', 'name_asc', 'name_desc']).optional(),
  limit: yup.number().integer().min(1).max(100).optional(),
  offset: yup.number().integer().min(0).optional(),
});

@controller("/marketplace")
export class MarketplaceController {
    constructor(
        @inject("MarketplaceService") private marketplaceService: IMarketplaceService,
        @inject("LogService") private logService: ILogService,
        @inject("DatabaseService") private databaseService: IDatabaseService // Assuming a DatabaseService is injected for raw queries
    ) { }

    private async logAction(
        req: Request,
        tableName?: string,
        statusCode?: number,
        metadata?: object
    ) {
        try {
            const requestBody = { ...req.body };

            if (metadata) {
                requestBody.metadata = metadata;
            }

            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] as string || req.socket.remoteAddress as string,
                table_name: tableName,
                controller: 'MarketplaceController',
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: (req as AuthenticatedRequest).user?.user_id as string,
                status_code: statusCode
            });
        } catch (error) {
            console.error('Failed to log action:', error);
        }
    }

    // --- VENTES ---

    @describe({
        endpoint: "/marketplace/sales",
        method: "POST",
        description: "Create a new sale in the marketplace",
        body: {
            item_id: "string",
            unique_id: "string (optional)",
            price: "number"
        },
        responseType: {
            id: "string",
            seller_user_id: "string",
            item_id: "string",
            unique_id: "string",
            price: "number",
            status: "'active' | 'sold' | 'cancelled'",
            created_at: "string",
            sold_at: "string",
            buyer_user_id: "string"
        },
        requiresAuth: true,
    })
    @httpPost("/sales", LoggedCheck.middleware)
    public async createSale(req: AuthenticatedRequest, res: Response) {
        try {
            if (!(await validateOr400(createSaleSchema, req.body, res))) return;

            const sale = await this.marketplaceService.createSale(req.user.user_id, req.body);
            await this.logAction(req, 'marketplace_sales', 201);

            res.status(201).send({
                message: "Sale created successfully",
                sale
            });
        } catch (error) {
            await this.logAction(req, 'marketplace_sales', 400);
            handleError(res, error, "Failed to create sale", 400);
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
            await this.marketplaceService.cancelSale(req.params.saleId, req.user.user_id);
            await this.logAction(req, 'marketplace_sales', 200);

            res.send({ message: "Sale cancelled successfully" });
        } catch (error) {
            await this.logAction(req, 'marketplace_sales', 400);
            handleError(res, error, "Failed to cancel sale", 400);
        }
    }

    @describe({
        endpoint: "/marketplace/sales/:saleId",
        method: "GET",
        description: "Get sale details",
        params: { saleId: "The ID of the sale" },
        responseType: {
            id: "string",
            seller_user_id: "string",
            item_id: "string",
            unique_id: "string (optional)",
            price: "number",
            status: "'active' | 'sold' | 'cancelled'",
            created_at: "string",
            sold_at: "string (optional)",
            buyer_user_id: "string (optional)",
            item_name: "string (optional)",
            item_description: "string (optional)",
            item_icon_hash: "string (optional)",
            seller_username: "string (optional)",
            buyer_username: "string (optional)",
            metadata: "object (optional)"
        },
    })
    @httpGet("/sales/:saleId")
    public async getSale(req: Request, res: Response) {
        try {
            const sale = await this.marketplaceService.getSaleById(req.params.saleId);
            if (!sale) {
                await this.logAction(req, 'marketplace_sales', 404);
                return res.status(404).send({ message: "Sale not found" });
            }

            await this.logAction(req, 'marketplace_sales', 200);
            res.send(sale);
        } catch (error) {
            await this.logAction(req, 'marketplace_sales', 500);
            handleError(res, error, "Failed to get sale");
        }
    }

    @describe({
        endpoint: "/marketplace/sales",
        method: "GET",
        description: "Get active sales with optional filtering",
        query: {
            item_id: "string (optional)",
            limit: "number (optional, default 50)",
            offset: "number (optional, default 0)"
        },
        responseType: ["MarketplaceSaleWithDetails"],
    })
    @httpGet("/sales")
    public async getActiveSales(req: Request, res: Response) {
        try {
            const { item_id, limit = 50, offset = 0 } = req.query;

            const sales = await this.marketplaceService.getActiveSales(
                item_id as string,
                parseInt(limit as string),
                parseInt(offset as string)
            );

            await this.logAction(req, 'marketplace_sales', 200);
            res.send(sales);
        } catch (error) {
            await this.logAction(req, 'marketplace_sales', 500);
            handleError(res, error, "Failed to get sales");
        }
    }

    @describe({
        endpoint: "/marketplace/my-sales",
        method: "GET",
        description: "Get user's sales",
        query: { status: "string (optional)" },
        responseType: ["MarketplaceSaleWithDetails"],
        requiresAuth: true,
    })
    @httpGet("/my-sales", LoggedCheck.middleware)
    public async getMySales(req: AuthenticatedRequest, res: Response) {
        try {
            const { status } = req.query;

            const sales = await this.marketplaceService.getUserSales(
                req.user.user_id,
                status as string
            );

            await this.logAction(req, 'marketplace_sales', 200);
            res.send(sales);
        } catch (error) {
            await this.logAction(req, 'marketplace_sales', 500);
            handleError(res, error, "Failed to get user sales");
        }
    }

    // --- ORDRES D'ACHAT ---

    @describe({
        endpoint: "/marketplace/buy-orders",
        method: "POST",
        description: "Create new buy order(s)",
        body: {
            item_id: "string",
            max_price: "number",
            quantity: "number (optional, default 1)"
        },
        responseType: ["MarketplaceBuyOrder"],
        requiresAuth: true,
    })
    @httpPost("/buy-orders", LoggedCheck.middleware)
    public async createBuyOrder(req: AuthenticatedRequest, res: Response) {
        try {
            if (!(await validateOr400(createBuyOrderSchema, req.body, res))) return;

            const orders = await this.marketplaceService.createBuyOrder(req.user.user_id, req.body);
            await this.logAction(req, 'marketplace_buy_orders', 201);

            res.status(201).send({
                message: "Buy order(s) created successfully",
                orders
            });
        } catch (error) {
            await this.logAction(req, 'marketplace_buy_orders', 400);
            handleError(res, error, "Failed to create buy order", 400);
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
            await this.marketplaceService.cancelBuyOrder(req.params.orderId, req.user.user_id);
            await this.logAction(req, 'marketplace_buy_orders', 200);

            res.send({ message: "Buy order cancelled successfully" });
        } catch (error) {
            await this.logAction(req, 'marketplace_buy_orders', 400);
            handleError(res, error, "Failed to cancel buy order", 400);
        }
    }
    
    @describe({
        endpoint: "/marketplace/buy-orders/:orderId",
        method: "GET",
        description: "Get buy order details",
        params: { orderId: "The ID of the buy order" },
        responseType: {
            id: "string",
            buyer_user_id: "string",
            item_id: "string",
            max_price: "number",
            status: "'active' | 'filled' | 'cancelled'",
            created_at: "string",
            filled_at: "string (optional)",
            sale_id: "string (optional)",
            item_name: "string",
            item_description: "string (optional)",
            item_icon_hash: "string (optional)",
            buyer_username: "string"
        },
    })
    @httpGet("/buy-orders/:orderId")
    public async getBuyOrder(req: Request, res: Response) {
        try {
            const order = await this.marketplaceService.getBuyOrderById(req.params.orderId);
            if (!order) {
                await this.logAction(req, 'marketplace_buy_orders', 404);
                return res.status(404).send({ message: "Buy order not found" });
            }

            await this.logAction(req, 'marketplace_buy_orders', 200);
            res.send(order);
        } catch (error) {
            await this.logAction(req, 'marketplace_buy_orders', 500);
            handleError(res, error, "Failed to get buy order");
        }
    }

    @describe({
        endpoint: "/marketplace/buy-orders",
        method: "GET",
        description: "Get active buy orders with optional filtering",
        query: {
            item_id: "string (optional)",
            limit: "number (optional, default 50)",
            offset: "number (optional, default 0)"
        },
        responseType: ["MarketplaceBuyOrderWithDetails"],
    })
    @httpGet("/buy-orders")
    public async getActiveBuyOrders(req: Request, res: Response) {
        try {
            const { item_id, limit = 50, offset = 0 } = req.query;

            const orders = await this.marketplaceService.getActiveBuyOrders(
                item_id as string,
                parseInt(limit as string),
                parseInt(offset as string)
            );

            await this.logAction(req, 'marketplace_buy_orders', 200);
            res.send(orders);
        } catch (error) {
            await this.logAction(req, 'marketplace_buy_orders', 500);
            handleError(res, error, "Failed to get buy orders");
        }
    }

    @describe({
        endpoint: "/marketplace/my-buy-orders",
        method: "GET",
        description: "Get user's buy orders",
        query: { status: "string (optional)" },
        responseType: ["MarketplaceBuyOrderWithDetails"],
        requiresAuth: true,
    })
    @httpGet("/my-buy-orders", LoggedCheck.middleware)
    public async getMyBuyOrders(req: AuthenticatedRequest, res: Response) {
        try {
            const { status } = req.query;

            const orders = await this.marketplaceService.getUserBuyOrders(
                req.user.user_id,
                status as string
            );

            await this.logAction(req, 'marketplace_buy_orders', 200);
            res.send(orders);
        } catch (error) {
            await this.logAction(req, 'marketplace_buy_orders', 500);
            handleError(res, error, "Failed to get user buy orders");
        }
    }

    // --- HISTORIQUE ---

    @describe({
        endpoint: "/marketplace/history",
        method: "GET",
        description: "Get user's marketplace history",
        query: {
            limit: "number (optional, default 50)",
            offset: "number (optional, default 0)"
        },
        responseType: {
            sales: ["MarketplaceSaleWithDetails"],
            purchases: ["MarketplaceSaleWithDetails"],
            buyOrders: ["MarketplaceBuyOrderWithDetails"]
        },
        requiresAuth: true,
    })
    @httpGet("/history", LoggedCheck.middleware)
    public async getMarketplaceHistory(req: AuthenticatedRequest, res: Response) {
        try {
            const { limit = 50, offset = 0 } = req.query;

            const history = await this.marketplaceService.getMarketplaceHistory(
                req.user.user_id,
                parseInt(limit as string),
                parseInt(offset as string)
            );

            await this.logAction(req, 'marketplace_sales,marketplace_buy_orders', 200);
            res.send(history);
        } catch (error) {
            await this.logAction(req, 'marketplace_sales,marketplace_buy_orders', 500);
            handleError(res, error, "Failed to get marketplace history");
        }
    }

    @describe({
        endpoint: "/marketplace/search",
        method: "GET",
        description: "Search and filter marketplace sales with advanced options",
        query: {
          query: "string (optional) - Search by item name",
          item_id: "string (optional) - Filter by specific item ID",
          min_price: "number (optional) - Minimum price filter",
          max_price: "number (optional) - Maximum price filter", 
          seller_username: "string (optional) - Search by seller username",
          has_metadata: "boolean (optional) - Filter items with/without metadata",
          sort_by: "string (optional) - Sort by: price_asc, price_desc, date_asc, date_desc, name_asc, name_desc",
          limit: "number (optional, default 50, max 100) - Number of results per page",
          offset: "number (optional, default 0) - Pagination offset"
        },
        responseType: {
          sales: ["MarketplaceSaleWithDetails"],
          total_count: "number",
          filters_applied: "object"
        },
    })
    @httpGet("/search")
    public async searchMarketplace(req: Request, res: Response) {
        try {
            if (!(await validateOr400(searchMarketplaceSchema, req.query, res))) return;

            const searchParams = {
                query: req.query.query as string,
                item_id: req.query.item_id as string,
                min_price: req.query.min_price ? parseFloat(req.query.min_price as string) : undefined,
                max_price: req.query.max_price ? parseFloat(req.query.max_price as string) : undefined,
                seller_username: req.query.seller_username as string,
                has_metadata: req.query.has_metadata ? req.query.has_metadata === 'true' : undefined,
                sort_by: req.query.sort_by as any,
                limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
                offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
            };

            const result = await this.marketplaceService.searchMarketplace(searchParams);
            await this.logAction(req, 'marketplace_sales', 200, { search_params: searchParams });
            
            res.send(result);
        } catch (error) {
            await this.logAction(req, 'marketplace_sales', 500);
            handleError(res, error, "Failed to search marketplace");
        }
    }

    @describe({
        endpoint: "/marketplace/items",
        method: "GET",
        description: "Get all unique items currently for sale with their lowest prices",
        query: {
          query: "string (optional) - Search by item name",
          limit: "number (optional, default 50)",
          offset: "number (optional, default 0)"
        },
        responseType: [{
          item_id: "string",
          item_name: "string",
          item_description: "string (optional)",
          item_icon_hash: "string (optional)",
          lowest_price: "number",
          highest_price: "number",
          total_listings: "number",
          has_metadata_items: "boolean"
        }],
    })
    @httpGet("/items")
    public async getMarketplaceItems(req: Request, res: Response) {
        try {
            const { query, limit = 50, offset = 0 } = req.query;
            
            let baseQuery = `
              SELECT 
                ms.item_id,
                i.name as item_name,
                i.description as item_description,
                i.iconHash as item_icon_hash,
                MIN(ms.price) as lowest_price,
                MAX(ms.price) as highest_price,
                COUNT(*) as total_listings,
                CASE WHEN COUNT(ms.unique_id) > 0 THEN 1 ELSE 0 END as has_metadata_items
              FROM marketplace_sales ms
              LEFT JOIN items i ON ms.item_id = i.itemId
              WHERE ms.status = 'active'
            `;

            const params: any[] = [];

            if (query) {
                baseQuery += " AND i.name LIKE ?";
                params.push(`%${query}%`);
            }

            baseQuery += `
              GROUP BY ms.item_id, i.name, i.description, i.iconHash
              ORDER BY i.name ASC
              LIMIT ? OFFSET ?
            `;
            
            params.push(parseInt(limit as string), parseInt(offset as string));

            const items = await this.databaseService.read<any[]>(baseQuery, params);
            
            await this.logAction(req, 'marketplace_sales', 200);
            res.send(items);
        } catch (error) {
            await this.logAction(req, 'marketplace_sales', 500);
            handleError(res, error, "Failed to get marketplace items");
        }
    }
}