import { Context } from 'hono';
import { IGameService } from '../services/GameService';
import { IInventoryService } from '../services/InventoryService';
import { IItemService } from '../services/ItemService';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
export declare class SearchController {
    private userService;
    private itemService;
    private gameService;
    private inventoryService;
    private logService;
    constructor(userService: IUserService, itemService: IItemService, gameService: IGameService, inventoryService: IInventoryService, logService: ILogService);
    private createLog;
    private handleSearch;
    globalSearch(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, 400, "json">) | (Response & import("hono").TypedResponse<{
        users: {
            user_id?: string | undefined;
            username?: string | undefined;
            verified?: boolean | undefined;
            isStudio?: boolean | undefined;
            admin?: boolean | undefined;
            badges?: ("staff" | "moderator" | "community_manager" | "early_user" | "bug_hunter" | "contributor" | "partner")[] | undefined;
            beta_user?: boolean | undefined;
            created_at?: string | undefined;
            updated_at?: string | undefined;
            disabled?: boolean | undefined;
            inventory?: {
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
            }[] | undefined;
            ownedItems?: {
                itemId: string;
                name: string;
                description: string;
                price: number;
                owner: string;
                showInStore: boolean;
                iconHash: string;
                deleted: boolean;
            }[] | undefined;
            createdGames?: {
                gameId: string;
                name: string;
                description: string;
                owner_id: string;
                download_link?: string | null | undefined;
                price: number;
                showInStore: boolean;
                iconHash?: string | null | undefined;
                splashHash?: string | null | undefined;
                bannerHash?: string | null | undefined;
                genre?: string | null | undefined;
                release_date?: string | null | undefined;
                developer?: string | null | undefined;
                publisher?: string | null | undefined;
                platforms?: string | null | undefined;
                rating: number;
                website?: string | null | undefined;
                trailer_link?: string | null | undefined;
                multiplayer: boolean;
                markAsUpdated?: boolean | undefined;
            }[] | undefined;
            id: any;
        }[];
        items: {
            itemId: string;
            name: string;
            description: string;
            price: number;
            owner: string;
            showInStore: boolean;
            iconHash: string;
            deleted: boolean;
        }[];
        games: {
            download_link?: string | null | undefined;
            gameId: string;
            name: string;
            description: string;
            price: number;
            owner_id: string;
            showInStore: boolean;
            iconHash: string | null | undefined;
            splashHash: string | null | undefined;
            bannerHash: string | null | undefined;
            genre: string | null | undefined;
            release_date: string | null | undefined;
            developer: string | null | undefined;
            publisher: string | null | undefined;
            platforms: string | null | undefined;
            rating: number;
            website: string | null | undefined;
            trailer_link: string | null | undefined;
            multiplayer: boolean;
        }[];
    }, 200, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, 500, "json">)>;
}
