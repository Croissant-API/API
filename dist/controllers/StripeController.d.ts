import { Request, Response } from "express";
import { IUserService } from "../services/UserService";
import { ILogService } from "../services/LogService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class StripeController {
    private userService;
    private logService;
    private stripe;
    constructor(userService: IUserService, logService: ILogService);
    private logAction;
    handleWebhook(req: Request, res: Response): Promise<void>;
    checkoutEndpoint(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getTiers(req: Request, res: Response): Promise<void>;
    private processWebhookEvent;
    private handleCheckoutCompleted;
    private createCheckoutSession;
}
