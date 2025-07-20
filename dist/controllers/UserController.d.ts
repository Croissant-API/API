import { Request, Response } from 'express';
import { IUserService } from '../services/UserService';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
export declare class Users {
    private userService;
    constructor(userService: IUserService);
    getMe(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    searchUsers(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    adminSearchUsers(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getAllUsers(req: Request, res: Response): Promise<void>;
    adminGetAllUsers(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    disableAccount(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    reenableAccount(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    adminGetUser(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    checkVerificationKey(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getUser(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    register(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    login(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    changePassword(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    transferCredits(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
