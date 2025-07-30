import { Request, Response } from "express";
import { IMarketplaceService } from "../services/MarketplaceService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class MarketplaceController {
    private marketplaceService;
    constructor(marketplaceService: IMarketplaceService);
    createSale(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createBuyOrder(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    cancelSale(req: AuthenticatedRequest, res: Response): Promise<void>;
    cancelBuyOrder(req: AuthenticatedRequest, res: Response): Promise<void>;
    getMySales(req: AuthenticatedRequest, res: Response): Promise<void>;
    getMyBuyOrders(req: AuthenticatedRequest, res: Response): Promise<void>;
    getItemMarketplace(req: Request, res: Response): Promise<void>;
    getHistory(req: AuthenticatedRequest, res: Response): Promise<void>;
    searchItems(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getMySellableItems(req: AuthenticatedRequest, res: Response): Promise<void>;
}
