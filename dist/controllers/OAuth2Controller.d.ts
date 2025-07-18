import { Request, Response } from "express";
import { IOAuth2Service } from "../services/OAuth2Service";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class OAuth2 {
    private oauth2Service;
    constructor(oauth2Service: IOAuth2Service);
    getAppByClientId(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createApp(req: AuthenticatedRequest, res: Response): Promise<void>;
    getMyApps(req: AuthenticatedRequest, res: Response): Promise<void>;
    authorize(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getUserByCode(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deleteApp(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateApp(req: AuthenticatedRequest, res: Response): Promise<void>;
}
