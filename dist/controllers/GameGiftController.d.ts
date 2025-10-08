import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { IGameGiftService } from "../services/GameGiftService";
import { IGameService } from "../services/GameService";
import { ILogService } from "../services/LogService";
import { IUserService } from "../services/UserService";
export declare class GameGifts {
    private giftService;
    private gameService;
    private userService;
    private logService;
    constructor(giftService: IGameGiftService, gameService: IGameService, userService: IUserService, logService: ILogService);
    private createLog;
    handleGiftActions(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getSentGifts(req: AuthenticatedRequest, res: Response): Promise<void>;
    getReceivedGifts(req: AuthenticatedRequest, res: Response): Promise<void>;
    getGiftInfo(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    revokeGift(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
