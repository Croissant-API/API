import { Context } from 'hono';
import { IBuyOrderService } from '../services/BuyOrderService';
import { IItemService } from '../services/ItemService';
import { ILogService } from '../services/LogService';
export declare class BuyOrderController {
    private buyOrderService;
    private itemService;
    private logService;
    constructor(buyOrderService: IBuyOrderService, itemService: IItemService, logService: ILogService);
    private logAction;
    private sendError;
    private getUserFromContext;
    createBuyOrder(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id: string;
        buyer_id: string;
        item_id: string;
        price: number;
        status: "active" | "fulfilled" | "cancelled";
        created_at: string;
        updated_at: string;
        fulfilled_at?: string | undefined;
    }, 201, "json">)>;
    cancelBuyOrder(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 200, "json">)>;
    getBuyOrdersByUser(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id: string;
        buyer_id: string;
        item_id: string;
        price: number;
        status: "active" | "fulfilled" | "cancelled";
        created_at: string;
        updated_at: string;
        fulfilled_at?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getActiveBuyOrdersForItem(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id: string;
        buyer_id: string;
        item_id: string;
        price: number;
        status: "active" | "fulfilled" | "cancelled";
        created_at: string;
        updated_at: string;
        fulfilled_at?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
}
