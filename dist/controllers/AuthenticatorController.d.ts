import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
export declare class Authenticator {
    private userService;
    private logService;
    constructor(userService: IUserService, logService: ILogService);
    private logAction;
    verifyKey(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    handleAuthenticatorActions(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
