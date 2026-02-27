import { Context } from 'hono';
import { IInventoryService } from '../services/InventoryService';
import { IItemService } from '../services/ItemService';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
export declare class Items {
    private itemService;
    private inventoryService;
    private userService;
    private logService;
    constructor(itemService: IItemService, inventoryService: IInventoryService, userService: IUserService, logService: ILogService);
    giveItem(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    private sendError;
    private createLog;
    private getUserFromContext;
    getAllItems(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        itemId: string;
        name: string;
        description: string;
        price: number;
        owner: string;
        showInStore: boolean;
        iconHash: string;
        deleted: boolean;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getMyItems(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        itemId: string;
        name: string;
        description: string;
        price: number;
        owner: string;
        showInStore: boolean;
        iconHash: string;
        deleted: boolean;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    searchItems(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        itemId: string;
        name: string;
        description: string;
        price: number;
        owner: string;
        showInStore: boolean;
        iconHash: string;
        deleted: boolean;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getItem(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        itemId: string;
        name: string;
        description: string;
        price: number;
        owner: string;
        showInStore: boolean;
        iconHash: string;
        deleted: boolean;
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    createItem(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    updateItem(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    deleteItem(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    buyItem(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    sellItem(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    consumeItem(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    dropItem(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    transferOwnership(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
}
