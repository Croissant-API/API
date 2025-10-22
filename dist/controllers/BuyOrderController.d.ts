import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
import { IBuyOrderService } from '../services/BuyOrderService';
import { IItemService } from '../services/ItemService';
import { ILogService } from '../services/LogService';
export declare class BuyOrderController {
    private buyOrderService;
    private itemService;
    private logService;
    constructor(buyOrderService: IBuyOrderService, itemService: IItemService, logService: ILogService);
    private logAction;
    createBuyOrder(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    cancelBuyOrder(req: AuthenticatedRequest, res: Response): Promise<void>;
    getBuyOrdersByUser(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getActiveBuyOrdersForItem(req: AuthenticatedRequest, res: Response): Promise<void>;
}
