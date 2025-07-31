import { Response } from "express";
import { IBuyOrderService } from "../services/BuyOrderService";
import { IItemService } from "../services/ItemService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class BuyOrderController {
    private buyOrderService;
    private itemService;
    constructor(buyOrderService: IBuyOrderService, itemService: IItemService);
    createBuyOrder(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    cancelBuyOrder(req: AuthenticatedRequest, res: Response): Promise<void>;
    getBuyOrdersByUser(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getActiveBuyOrdersForItem(req: AuthenticatedRequest, res: Response): Promise<void>;
}
