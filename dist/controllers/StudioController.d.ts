import { Request, Response } from "express";
import { IStudioService } from "../services/StudioService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { ILogService } from "../services/LogService";
export declare class Studios {
    private studioService;
    private logService;
    constructor(studioService: IStudioService, logService: ILogService);
    private logAction;
    createStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getStudio(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getMyStudios(req: AuthenticatedRequest, res: Response): Promise<void>;
    addUserToStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    removeUserFromStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
