import { Request, Response } from "express";
import { IGameService } from "../services/GameService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { IUserService } from "../services/UserService";
import { AuthenticatedRequestWithOwner } from "../middlewares/OwnerCheck";
export declare class Games {
    private gameService;
    private userService;
    constructor(gameService: IGameService, userService: IUserService);
    listGames(req: Request, res: Response): Promise<void>;
    searchGames(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getMyCreatedGames(req: AuthenticatedRequest, res: Response): Promise<void>;
    getUserGames(req: AuthenticatedRequest, res: Response): Promise<void>;
    getGame(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getGameDetails(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createGame(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    buyGame(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    transferOwnership(req: AuthenticatedRequestWithOwner, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
