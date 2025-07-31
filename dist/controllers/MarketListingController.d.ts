import { Response } from "express";
import { IMarketListingService } from "../services/MarketListingService";
import { ILogService } from "../services/LogService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class MarketListingController {
    private marketListingService;
    private logService;
    constructor(marketListingService: IMarketListingService, logService: ILogService);
    private logAction;
    createMarketListing(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    cancelMarketListing(req: AuthenticatedRequest, res: Response): Promise<void>;
    getMarketListingsByUser(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getActiveListingsForItem(req: AuthenticatedRequest, res: Response): Promise<void>;
    getMarketListingById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getEnrichedMarketListings(req: AuthenticatedRequest, res: Response): Promise<void>;
    searchMarketListings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    buyMarketListing(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
