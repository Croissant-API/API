import { Request, Response } from 'express';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
export declare class WebAuthn {
    private userService;
    private logService;
    constructor(userService: IUserService, logService: ILogService);
    private createLog;
    getRegistrationOptions(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    verifyRegistration(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getAuthenticationOptionsHandler(req: Request, res: Response): Promise<void>;
    verifyAuthenticationHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
