import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { IUserService } from "../services/UserService";
export declare class Authenticator {
    private userService;
    constructor(userService: IUserService);
    generateKey(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    registerKey(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    verifyKey(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    deleteKey(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
