import { Response } from 'express';
import { ITradeService } from '../services/TradeService';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
export declare class Trades {
    private tradeService;
    constructor(tradeService: ITradeService);
    startOrGetPendingTrade(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getTradeById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getTradesByUser(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    addItemToTrade(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    removeItemFromTrade(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    approveTrade(req: AuthenticatedRequest, res: Response): Promise<void>;
    cancelTrade(req: AuthenticatedRequest, res: Response): Promise<void>;
}
