import { Context } from 'hono';
import { IInventoryService } from '../services/InventoryService';
import { ILogService } from '../services/LogService';
export declare class Inventories {
    private inventoryService;
    private logService;
    constructor(inventoryService: IInventoryService, logService: ILogService);
    private createLog;
    private sendError;
    private getUserFromContext;
    getMyInventory(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        user_id: string;
        inventory: {
            user_id: string;
            item_id: string;
            amount: number;
            name?: string | undefined;
            iconHash?: string | undefined;
            description?: string | undefined;
            metadata?: {
                [x: string]: import("hono/utils/types").JSONValue;
            } | undefined;
            sellable: boolean;
            purchasePrice?: number | undefined;
            rarity: "very-common" | "common" | "uncommon" | "rare" | "very-rare" | "epic" | "ultra-epic" | "legendary" | "ancient" | "mythic" | "godlike" | "radiant";
            custom_url_link?: string | undefined;
        }[];
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getInventory(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        user_id: string;
        inventory: {
            user_id: string;
            item_id: string;
            amount: number;
            name?: string | undefined;
            iconHash?: string | undefined;
            description?: string | undefined;
            metadata?: {
                [x: string]: import("hono/utils/types").JSONValue;
            } | undefined;
            sellable: boolean;
            purchasePrice?: number | undefined;
            rarity: "very-common" | "common" | "uncommon" | "rare" | "very-rare" | "epic" | "ultra-epic" | "legendary" | "ancient" | "mythic" | "godlike" | "radiant";
            custom_url_link?: string | undefined;
        }[];
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getItemAmount(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        userId: string;
        itemId: string;
        amount: number;
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getAllInventories(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">>;
}
