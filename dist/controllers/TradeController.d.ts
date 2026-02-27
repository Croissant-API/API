import { Context } from 'hono';
import { ILogService } from '../services/LogService';
import { ITradeService } from '../services/TradeService';
export declare class Trades {
    private tradeService;
    private logService;
    constructor(tradeService: ITradeService, logService: ILogService);
    private sendError;
    private createLog;
    private getUserFromContext;
    startOrGetPendingTrade(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
    getTradeById(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
    getTradesByUser(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
    addItemToTrade(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
    removeItemFromTrade(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
    approveTrade(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
    cancelTrade(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
}
