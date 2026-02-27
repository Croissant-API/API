import { Context } from 'hono';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
export declare class AuthenticatorController {
    private userService;
    private logService;
    constructor(userService: IUserService, logService: ILogService);
    private logAction;
    private sendError;
    private getUserFromContext;
    verifyKey(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
        token: string;
    }, 200, "json">)>;
    handleAuthenticatorActions(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        key: {
            readonly issuer: string;
            readonly user: string;
            readonly secret: string;
            readonly url: string;
            readonly config: {
                secretSize: number;
                period: number;
                digits: number;
                algo: "sha256" | "sha1" | "sha512";
            };
        };
        qrCode: string;
    }, 200, "json">) | (Response & import("hono").TypedResponse<{
        message: string;
    }, 200, "json">)>;
}
