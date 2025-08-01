import { Response } from "express";
import { IGameGiftService } from "../services/GameGiftService";
import { IGameService } from "../services/GameService";
import { IUserService } from "../services/UserService";
import { ILogService } from "../services/LogService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class GameGifts {
    private giftService;
    private gameService;
    private userService;
    private logService;
    constructor(giftService: IGameGiftService, gameService: IGameService, userService: IUserService, logService: ILogService);
    private createLog;
    createGift(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    claimGift(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getSentGifts(req: AuthenticatedRequest, res: Response): Promise<void>;
    getReceivedGifts(req: AuthenticatedRequest, res: Response): Promise<void>;
    getGiftInfo(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    revokeGift(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
