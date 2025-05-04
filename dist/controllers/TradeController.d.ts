import { Response } from 'express';
import { ITradeService } from '../services/TradeService';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
export declare class TradeController {
    private tradeService;
    constructor(tradeService: ITradeService);
    createTrade(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getTradeById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getTradesByUser(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateTradeStatus(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    approveTrade(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deleteTrade(req: AuthenticatedRequest, res: Response): Promise<void>;
    addItemToTrade(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    removeItemToTrade(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
