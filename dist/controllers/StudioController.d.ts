import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { ILogService } from "../services/LogService";
import { IStudioService } from "../services/StudioService";
export declare class Studios {
    private studioService;
    private logService;
    constructor(studioService: IStudioService, logService: ILogService);
    private createLog;
    private handleError;
    private getStudioOrError;
    createStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getStudio(req: Request, res: Response): Promise<void>;
    getMyStudios(req: AuthenticatedRequest, res: Response): Promise<void>;
    private checkStudioAdmin;
    addUserToStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    removeUserFromStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
