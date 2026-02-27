import { Context } from 'hono';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
export declare class StripeController {
    private userService;
    private logService;
    private stripe;
    constructor(userService: IUserService, logService: ILogService);
    private createLog;
    getTiers(c: Context): Promise<Response & import("hono").TypedResponse<readonly [{
        readonly id: "tier1";
        readonly price: 99;
        readonly credits: 200;
        readonly name: "200 credits";
        readonly image: "https://croissant-api.fr/assets/credits/tier1.png";
    }, {
        readonly id: "tier2";
        readonly price: 198;
        readonly credits: 400;
        readonly name: "400 credits";
        readonly image: "https://croissant-api.fr/assets/credits/tier2.png";
    }, {
        readonly id: "tier3";
        readonly price: 495;
        readonly credits: 1000;
        readonly name: "1000 credits";
        readonly image: "https://croissant-api.fr/assets/credits/tier3.png";
    }, {
        readonly id: "tier4";
        readonly price: 990;
        readonly credits: 2000;
        readonly name: "2000 credits";
        readonly image: "https://croissant-api.fr/assets/credits/tier4.png";
    }], 200, "json">>;
    checkout(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: import("hono/utils/types").JSONValue;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        url: string;
    }, 200, "json">)>;
    webhook(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
        error: import("hono/utils/types").JSONValue;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        received: true;
    }, 200, "json">)>;
    private processWebhookEvent;
    private handleCheckoutCompleted;
    private createCheckoutSession;
}
