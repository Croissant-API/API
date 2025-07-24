import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { IUserService } from "../services/UserService";
export declare class StripeController {
    private userService;
    private stripe;
    constructor(userService: IUserService);
    /**
     * Stripe webhook endpoint
     * Handles all incoming Stripe webhook events
     */
    handleWebhook(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    checkoutEndpoint(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
