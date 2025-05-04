import { Request, Response } from 'express';
import { ILobbyService } from '../services/LobbyService';
export declare class LobbyController {
    private lobbyService;
    constructor(lobbyService: ILobbyService);
    getLobby(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    joinLobby(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    leaveLobby(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getUserLobby(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createLobby(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
