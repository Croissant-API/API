import { NextFunction, Request, Response } from "express";
import { User } from "../interfaces/User";
import { IStudioService } from "../services/StudioService";
export interface AuthenticatedRequest extends Request {
    user: User;
    originalUser?: User;
}
export declare class LoggedCheck {
    private studioService;
    constructor(studioService: IStudioService);
    static middleware: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
}
