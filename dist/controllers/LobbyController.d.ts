import { Request, Response } from "express";
import { ILobbyService } from "../services/LobbyService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class Lobbies {
    private lobbyService;
    constructor(lobbyService: ILobbyService);
    createLobby(req: AuthenticatedRequest, res: Response): Promise<void>;
    getLobby(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getMyLobby(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getUserLobby(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    joinLobby(req: AuthenticatedRequest, res: Response): Promise<void>;
    leaveLobby(req: AuthenticatedRequest, res: Response): Promise<void>;
}
