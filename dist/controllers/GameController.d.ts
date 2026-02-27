import { Context } from 'hono';
import { IGameService } from '../services/GameService';
import { IGameViewService } from '../services/GameViewService';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
export declare class Games {
    private gameService;
    private userService;
    private logService;
    private gameViewService;
    constructor(gameService: IGameService, userService: IUserService, logService: ILogService, gameViewService: IGameViewService);
    private createLog;
    private sendError;
    private getUserFromContext;
    listGames(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
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
        badges: {
            id: number;
            name: string;
            display_name: string;
            color: string;
            icon: string;
            expires_at: string;
        }[];
        views: {
            gameId: string;
            total_views: number;
            unique_views: number;
            views_today: number;
            views_this_week: number;
            views_this_month: number;
        };
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    searchGames(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
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
        badges: {
            id: number;
            name: string;
            display_name: string;
            color: string;
            icon: string;
            expires_at: string;
        }[];
        views: {
            gameId: string;
            total_views: number;
            unique_views: number;
            views_today: number;
            views_this_week: number;
            views_this_month: number;
        };
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getMyCreatedGames(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
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
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getUserGames(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
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
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getGame(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
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
        badges: {
            id: number;
            name: string;
            display_name: string;
            color: string;
            icon: string;
            expires_at: string;
        }[];
        views: {
            gameId: string;
            total_views: number;
            unique_views: number;
            views_today: number;
            views_this_week: number;
            views_this_month: number;
        };
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">) | undefined>;
    getGameDetails(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
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
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">) | undefined>;
    createGame(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
        game: {
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
        } | null;
    }, 201, "json">) | undefined>;
    updateGame(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
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
    } | null, 200, "json">) | undefined>;
    buyGame(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 200, "json">)>;
    transferOwnership(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
        game: {
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
        } | null;
    }, 200, "json">)>;
    transferGame(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 200, "json">) | undefined>;
    canTransferGame(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        canTransfer: boolean;
        reason?: string | undefined;
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">) | undefined>;
    downloadGame(c: Context): Promise<Response>;
    headDownloadGame(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<null, any, "body">)>;
}
