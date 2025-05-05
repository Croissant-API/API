import { Request, Response } from 'express';
import { IGameService } from '../services/GameService';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
export declare class GameController {
    private gameService;
    constructor(gameService: IGameService);
    listGames(req: Request, res: Response): Promise<void>;
    getGame(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getUserGames(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deleteGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    addOwner(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    removeOwner(req: AuthenticatedRequest, res: Response): Promise<void>;
}
