import { Request, Response } from "express";
import { IGameService } from "../services/GameService";
import { ILogService } from "../services/LogService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { IUserService } from "../services/UserService";
export declare class Games {
    private gameService;
    private userService;
    private logService;
    constructor(gameService: IGameService, userService: IUserService, logService: ILogService);
    private createLog;
    listGames(req: Request, res: Response): Promise<void>;
    searchGames(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getMyCreatedGames(req: AuthenticatedRequest, res: Response): Promise<void>;
    getUserGames(req: AuthenticatedRequest, res: Response): Promise<void>;
    getGame(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getGameDetails(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createGame(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    buyGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    transferOwnership(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    transferGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    canTransferGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
