import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
import { ILobbyService } from '../services/LobbyService';
import { ILogService } from '../services/LogService';
export declare class Lobbies {
    private lobbyService;
    private logService;
    constructor(lobbyService: ILobbyService, logService: ILogService);
    private createLog;
    createLobby(req: AuthenticatedRequest, res: Response): Promise<void>;
    getLobby(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getMyLobby(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getUserLobby(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    joinLobby(req: AuthenticatedRequest, res: Response): Promise<void>;
    leaveLobby(req: AuthenticatedRequest, res: Response): Promise<void>;
}
