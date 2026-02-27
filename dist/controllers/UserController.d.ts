import { Context } from 'hono';
import { ILogService } from '../services/LogService';
import { MailService } from '../services/MailService';
import { SteamOAuthService } from '../services/SteamOAuthService';
import { StudioService } from '../services/StudioService';
import { IUserService } from '../services/UserService';
export declare class Users {
    private userService;
    private logService;
    private mailService;
    private studioService;
    private steamOAuthService;
    constructor(userService: IUserService, logService: ILogService, mailService: MailService, studioService: StudioService, steamOAuthService: SteamOAuthService);
    private sendError;
    private createLog;
    private mapUser;
    private mapUserSearch;
    private getUserFromContext;
    private getOriginalUserFromContext;
    loginOAuth(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    register(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    login(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    getMe(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        verificationKey: string;
        google_id: string | undefined;
        discord_id: string | undefined;
        studios: {
            id: string;
            name: string;
            verified: boolean;
            user_id: string;
            admin_id: string;
            users: {
                email: string;
                password?: string | undefined;
                discord_id?: string | undefined;
                google_id?: string | undefined;
                steam_id?: string | undefined;
                steam_username?: string | undefined;
                steam_avatar_url?: string | undefined;
                forgot_password_token?: string | undefined;
                balance: number;
                free_balance: number;
                disabled?: boolean | undefined;
                webauthn_challenge: string;
                webauthn_credentials?: string | undefined;
                authenticator_secret?: string | undefined;
                created_at: string;
                updated_at: string;
                user_id: string;
                username: string;
                verified: boolean;
                isStudio: boolean;
                admin?: boolean | undefined;
                badges: ("staff" | "moderator" | "community_manager" | "early_user" | "bug_hunter" | "contributor" | "partner")[];
                beta_user: boolean;
            }[];
            me: {
                user_id: string;
                username: string;
                verified: boolean;
            };
            isAdmin: boolean;
            apiKey: string | undefined;
        }[];
        roles: string[];
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
        ownedItems: {
            itemId: string;
            name: string;
            description: string;
            price: number;
            owner: string;
            showInStore: boolean;
            iconHash: string;
            deleted: boolean;
        }[];
        createdGames: {
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
        }[];
        haveAuthenticator: boolean;
        id: string;
        userId: string;
        username: string;
        email: string;
        balance: number | undefined;
        verified: boolean;
        steam_id: string | undefined;
        steam_username: string | undefined;
        steam_avatar_url: string | undefined;
        isStudio: boolean;
        admin: boolean;
        disabled: boolean;
        badges: ("staff" | "moderator" | "community_manager" | "early_user" | "bug_hunter" | "contributor" | "partner")[];
        created_at: string;
    }, 200, "json">)>;
    changeUsername(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    changePassword(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    forgotPassword(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    resetPassword(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    isValidResetToken(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    steamRedirect(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<string, 200, "json">)>;
    steamAssociate(c: Context): Promise<Response>;
    unlinkSteam(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    searchUsers(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id: string;
        userId: string;
        username: string;
        verified: boolean;
        isStudio: boolean;
        admin: boolean;
        badges: ("staff" | "moderator" | "community_manager" | "early_user" | "bug_hunter" | "contributor" | "partner")[];
        disabled: boolean;
        created_at: string | undefined;
    }[], 200, "json">)>;
    getUser(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        studios: {
            id: string;
            name: string;
            verified: boolean;
        }[];
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
        ownedItems: {
            itemId: string;
            name: string;
            description: string;
            price: number;
            owner: string;
            showInStore: boolean;
            iconHash: string;
            deleted: boolean;
        }[];
        createdGames: {
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
        }[];
        id: string;
        userId: string;
        username: string;
        verified: boolean;
        isStudio: boolean;
        admin: boolean;
        badges: ("staff" | "moderator" | "community_manager" | "early_user" | "bug_hunter" | "contributor" | "partner")[];
        disabled: boolean;
        created_at: string | undefined;
    }, 200, "json">)>;
    adminSearchUsers(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id: string;
        userId: string;
        username: string;
        verified: boolean;
        isStudio: boolean;
        admin: boolean;
        badges: ("staff" | "moderator" | "community_manager" | "early_user" | "bug_hunter" | "contributor" | "partner")[];
        disabled: boolean;
        created_at: string | undefined;
    }[], 200, "json">)>;
    disableAccount(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    reenableAccount(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    adminGetUser(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        disabled: boolean | undefined;
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
        ownedItems: {
            itemId: string;
            name: string;
            description: string;
            price: number;
            owner: string;
            showInStore: boolean;
            iconHash: string;
            deleted: boolean;
        }[];
        createdGames: {
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
        }[];
        id: string;
        userId: string;
        username: string;
        verified: boolean;
        isStudio: boolean;
        admin: boolean;
        badges: ("staff" | "moderator" | "community_manager" | "early_user" | "bug_hunter" | "contributor" | "partner")[];
        created_at: string | undefined;
    }, 200, "json">)>;
    transferCredits(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    checkVerificationKey(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        success: boolean;
    }, 200 | 401, "json">)>;
    changeRole(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    private verifyDiscordToken;
    private verifyGoogleToken;
}
