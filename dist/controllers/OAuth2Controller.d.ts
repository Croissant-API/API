import { Context } from 'hono';
import { ILogService } from '../services/LogService';
import { IOAuth2Service } from '../services/OAuth2Service';
export declare class OAuth2Controller {
    private oauth2Service;
    private logService;
    constructor(oauth2Service: IOAuth2Service, logService: ILogService);
    private createLog;
    getAppByClientId(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 404, "json">) | (Response & import("hono").TypedResponse<{
        owner_id: string;
        client_id: string;
        client_secret: string;
        name: string;
        redirect_urls: string[];
    }, 200, "json">)>;
    createApp(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 400, "json">) | (Response & import("hono").TypedResponse<{
        client_id: string;
        client_secret: string;
    }, 201, "json">)>;
    getMyApps(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 401, "json">) | (Response & import("hono").TypedResponse<{
        owner_id: string;
        client_id: string;
        client_secret: string;
        name: string;
        redirect_urls: string[];
    }[], 200, "json">)>;
    updateApp(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 401, "json">) | (Response & import("hono").TypedResponse<{
        success: true;
    }, 200, "json">)>;
    deleteApp(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 401, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 200, "json">)>;
    authorize(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 401, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 400, "json">) | (Response & import("hono").TypedResponse<{
        code: string;
    }, 200, "json">)>;
    getUserByCode(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 400, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 404, "json">) | (Response & import("hono").TypedResponse<{
        verificationKey: string;
        username: string;
        user_id: string;
        email: string;
        balance: number;
        verified: boolean;
        steam_username?: string | undefined;
        steam_avatar_url?: string | undefined;
        steam_id?: string | undefined;
        discord_id?: string | undefined;
        google_id?: string | undefined;
    }, 200, "json">)>;
}
