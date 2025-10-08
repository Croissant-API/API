import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { ILogService } from "../services/LogService";
import { IUserService } from "../services/UserService";
export declare class StripeController {
    private userService;
    private logService;
    private stripe;
    constructor(userService: IUserService, logService: ILogService);
    private createLog;
    handleWebhook(req: Request, res: Response): Promise<void>;
    checkoutEndpoint(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getTiers(req: Request, res: Response): Promise<void>;
    private processWebhookEvent;
    private handleCheckoutCompleted;
    private createCheckoutSession;
}
