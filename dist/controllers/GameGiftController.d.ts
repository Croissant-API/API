import { Context } from 'hono';
import { IGameGiftService } from '../services/GameGiftService';
import { IGameService } from '../services/GameService';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
export declare class GameGifts {
    private giftService;
    private gameService;
    private userService;
    private logService;
    constructor(giftService: IGameGiftService, gameService: IGameService, userService: IUserService, logService: ILogService);
    private createLog;
    private sendError;
    private getUserFromContext;
    handleGiftActions(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
        gift: {
            id: string;
            gameId: string;
            giftCode: string;
            createdAt: string;
            message: string | undefined;
        };
    }, 201, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
        gift: {
            id: string;
            gameId: string;
            fromUserId: string;
            toUserId?: string | undefined;
            giftCode: string;
            createdAt: string;
            claimedAt?: string | undefined;
            isActive: boolean;
            message?: string | undefined;
        };
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getSentGifts(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
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
        id: string;
        gameId: string;
        fromUserId: string;
        toUserId?: string | undefined;
        giftCode: string;
        createdAt: string;
        claimedAt?: string | undefined;
        isActive: boolean;
        message?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getReceivedGifts(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
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
        fromUser: {
            id: string;
            username: string;
        } | null;
        id: string;
        gameId: string;
        fromUserId: string;
        toUserId?: string | undefined;
        giftCode: string;
        createdAt: string;
        claimedAt?: string | undefined;
        isActive: boolean;
        message?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getGiftInfo(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        gift: {
            gameId: string;
            giftCode: string;
            createdAt: string;
            claimedAt: string | undefined;
            isActive: boolean;
            message: string | undefined;
        };
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
        fromUser: {
            id: string;
            username: string;
        } | null;
        userOwnsGame: boolean;
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    revokeGift(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string | undefined;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
}
