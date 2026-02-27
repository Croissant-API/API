import { Context } from 'hono';
import { ILobbyService } from '../services/LobbyService';
import { ILogService } from '../services/LogService';
export declare class Lobbies {
    private lobbyService;
    private logService;
    constructor(lobbyService: ILobbyService, logService: ILogService);
    private sendError;
    private createLog;
    private getUserFromContext;
    createLobby(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    getLobby(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        lobbyId: string;
        users: {
            user_id: string;
            username: string;
            verified: boolean;
            isStudio: boolean;
            admin?: boolean | undefined;
            badges: ("staff" | "moderator" | "community_manager" | "early_user" | "bug_hunter" | "contributor" | "partner")[];
            beta_user: boolean;
            created_at?: string | undefined;
            updated_at?: string | undefined;
            disabled?: boolean | undefined;
        }[];
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getMyLobby(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        lobbyId: string;
        users: {
            user_id: string;
            username: string;
            verified: boolean;
            isStudio: boolean;
            admin?: boolean | undefined;
            badges: ("staff" | "moderator" | "community_manager" | "early_user" | "bug_hunter" | "contributor" | "partner")[];
            beta_user: boolean;
            created_at?: string | undefined;
            updated_at?: string | undefined;
            disabled?: boolean | undefined;
        }[];
        success: true;
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getUserLobby(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        lobbyId: string;
        users: {
            user_id: string;
            username: string;
            verified: boolean;
            isStudio: boolean;
            admin?: boolean | undefined;
            badges: ("staff" | "moderator" | "community_manager" | "early_user" | "bug_hunter" | "contributor" | "partner")[];
            beta_user: boolean;
            created_at?: string | undefined;
            updated_at?: string | undefined;
            disabled?: boolean | undefined;
        }[];
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    joinLobby(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    leaveLobby(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
}
