import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
import { ILogService } from '../services/LogService';
export declare class LogController {
    private logService;
    constructor(logService: ILogService);
    getAllLogs(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getLogsByController(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getLogsByUser(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getLogsByTable(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getLogStats(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getMyLogs(req: AuthenticatedRequest, res: Response): Promise<void>;
}
