import { Request, Response } from "express";
import { IOAuth2Service } from "../services/OAuth2Service";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class OAuth2 {
    private oauth2Service;
    constructor(oauth2Service: IOAuth2Service);
    getAppByClientId(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createApp(req: AuthenticatedRequest, res: Response): Promise<void>;
    getMyApps(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateApp(req: AuthenticatedRequest, res: Response): Promise<void>;
    deleteApp(req: AuthenticatedRequest, res: Response): Promise<void>;
    authorize(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getUserByCode(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare function mapOAuthUser(user: {
    username: string;
    user_id: string;
    email: string;
    balance: number;
    verified: boolean;
    steam_username?: string;
    steam_avatar_url?: string;
    steam_id?: string;
}): {
    username: string;
    user_id: string;
    email: string;
    balance: number;
    verified: boolean;
    steam_username: string | undefined;
    steam_avatar_url: string | undefined;
    steam_id: string | undefined;
};
