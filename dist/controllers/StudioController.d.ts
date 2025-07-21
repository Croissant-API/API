import { Request, Response } from "express";
import { IStudioService } from "../services/StudioService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class Studios {
    private studioService;
    constructor(studioService: IStudioService);
    getStudio(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    addUserToStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    removeUserFromStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
