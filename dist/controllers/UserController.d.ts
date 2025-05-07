import { Request, Response } from 'express';
import { IUserService } from '../services/UserService';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
export declare class Users {
    private userService;
    constructor(userService: IUserService);
    getMe(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    searchUsers(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    checkVerificationKey(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getUser(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createUser(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    transferCredits(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
