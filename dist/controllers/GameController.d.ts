import { Request, Response } from 'express';
import { IGameService } from '../services/GameService';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
import { IUserService } from '../services/UserService';
export declare class Games {
    private gameService;
    private userService;
    constructor(gameService: IGameService, userService: IUserService);
    listGames(req: Request, res: Response): Promise<void>;
    getMyCreatedGames(req: AuthenticatedRequest, res: Response): Promise<void>;
    getUserGames(req: AuthenticatedRequest, res: Response): Promise<void>;
    getGamesByUserId(req: Request, res: Response): Promise<void>;
    getGame(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    updateGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deleteGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    buyGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
