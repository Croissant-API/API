import { Context } from 'hono';
import { ILogService } from '../services/LogService';
import { IMarketListingService } from '../services/MarketListingService';
export declare class MarketListingController {
    private marketListingService;
    private logService;
    constructor(marketListingService: IMarketListingService, logService: ILogService);
    private sendError;
    private createLog;
    private getUserFromContext;
    createMarketListing(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id: string;
        seller_id: string;
        item_id: string;
        price: number;
        status: import("../interfaces/MarketListing").MarketListingStatus;
        metadata?: {
            [x: string]: import("hono/utils/types").JSONValue;
            _unique_id?: string | undefined;
        } | undefined;
        created_at: string;
        updated_at: string;
        sold_at?: string | undefined;
        buyer_id?: string | undefined;
        purchasePrice?: number | undefined;
        rarity: "very-common" | "common" | "uncommon" | "rare" | "very-rare" | "epic" | "ultra-epic" | "legendary" | "ancient" | "mythic" | "godlike" | "radiant";
        custom_url_link?: string | undefined;
    }, 201, "json">)>;
    cancelMarketListing(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    getMarketListingsByUser(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        item_name: string;
        item_description: string;
        item_icon_hash: string;
        sellerName?: string | undefined;
        id: string;
        seller_id: string;
        item_id: string;
        price: number;
        status: import("../interfaces/MarketListing").MarketListingStatus;
        metadata?: {
            [x: string]: import("hono/utils/types").JSONValue;
            _unique_id?: string | undefined;
        } | undefined;
        created_at: string;
        updated_at: string;
        sold_at?: string | undefined;
        buyer_id?: string | undefined;
        purchasePrice?: number | undefined;
        rarity: "very-common" | "common" | "uncommon" | "rare" | "very-rare" | "epic" | "ultra-epic" | "legendary" | "ancient" | "mythic" | "godlike" | "radiant";
        custom_url_link?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getActiveListingsForItem(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id: string;
        seller_id: string;
        item_id: string;
        price: number;
        status: import("../interfaces/MarketListing").MarketListingStatus;
        metadata?: {
            [x: string]: import("hono/utils/types").JSONValue;
            _unique_id?: string | undefined;
        } | undefined;
        created_at: string;
        updated_at: string;
        sold_at?: string | undefined;
        buyer_id?: string | undefined;
        purchasePrice?: number | undefined;
        rarity: "very-common" | "common" | "uncommon" | "rare" | "very-rare" | "epic" | "ultra-epic" | "legendary" | "ancient" | "mythic" | "godlike" | "radiant";
        custom_url_link?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getMarketListingById(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id: string;
        seller_id: string;
        item_id: string;
        price: number;
        status: import("../interfaces/MarketListing").MarketListingStatus;
        metadata?: {
            [x: string]: import("hono/utils/types").JSONValue;
            _unique_id?: string | undefined;
        } | undefined;
        created_at: string;
        updated_at: string;
        sold_at?: string | undefined;
        buyer_id?: string | undefined;
        purchasePrice?: number | undefined;
        rarity: "very-common" | "common" | "uncommon" | "rare" | "very-rare" | "epic" | "ultra-epic" | "legendary" | "ancient" | "mythic" | "godlike" | "radiant";
        custom_url_link?: string | undefined;
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getEnrichedMarketListings(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        item_name: string;
        item_description: string;
        item_icon_hash: string;
        sellerName?: string | undefined;
        id: string;
        seller_id: string;
        item_id: string;
        price: number;
        status: import("../interfaces/MarketListing").MarketListingStatus;
        metadata?: {
            [x: string]: import("hono/utils/types").JSONValue;
            _unique_id?: string | undefined;
        } | undefined;
        created_at: string;
        updated_at: string;
        sold_at?: string | undefined;
        buyer_id?: string | undefined;
        purchasePrice?: number | undefined;
        rarity: "very-common" | "common" | "uncommon" | "rare" | "very-rare" | "epic" | "ultra-epic" | "legendary" | "ancient" | "mythic" | "godlike" | "radiant";
        custom_url_link?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    searchMarketListings(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        item_name: string;
        item_description: string;
        item_icon_hash: string;
        sellerName?: string | undefined;
        id: string;
        seller_id: string;
        item_id: string;
        price: number;
        status: import("../interfaces/MarketListing").MarketListingStatus;
        metadata?: {
            [x: string]: import("hono/utils/types").JSONValue;
            _unique_id?: string | undefined;
        } | undefined;
        created_at: string;
        updated_at: string;
        sold_at?: string | undefined;
        buyer_id?: string | undefined;
        purchasePrice?: number | undefined;
        rarity: "very-common" | "common" | "uncommon" | "rare" | "very-rare" | "epic" | "ultra-epic" | "legendary" | "ancient" | "mythic" | "godlike" | "radiant";
        custom_url_link?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    buyMarketListing(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id: string;
        seller_id: string;
        item_id: string;
        price: number;
        status: import("../interfaces/MarketListing").MarketListingStatus;
        metadata?: {
            [x: string]: import("hono/utils/types").JSONValue;
            _unique_id?: string | undefined;
        } | undefined;
        created_at: string;
        updated_at: string;
        sold_at?: string | undefined;
        buyer_id?: string | undefined;
        purchasePrice?: number | undefined;
        rarity: "very-common" | "common" | "uncommon" | "rare" | "very-rare" | "epic" | "ultra-epic" | "legendary" | "ancient" | "mythic" | "godlike" | "radiant";
        custom_url_link?: string | undefined;
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
}
