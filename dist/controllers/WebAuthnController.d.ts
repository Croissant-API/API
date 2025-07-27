import { Request, Response } from "express";
import { IUserService } from "../services/UserService";
export declare class WebAuthn {
    private userService;
    constructor(userService: IUserService);
    getRegistrationOptions(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    verifyRegistration(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getAuthenticationOptionsHandler(req: Request, res: Response): Promise<void>;
    verifyAuthenticationHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
