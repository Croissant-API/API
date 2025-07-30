import { Request, Response } from "express";
import { IUserService } from "../services/UserService";
import { IItemService } from "../services/ItemService";
import { IGameService } from "../services/GameService";
import { IInventoryService } from "../services/InventoryService";
import { ILogService } from "../services/LogService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class SearchController {
    private userService;
    private itemService;
    private gameService;
    private inventoryService;
    private logService;
    constructor(userService: IUserService, itemService: IItemService, gameService: IGameService, inventoryService: IInventoryService, logService: ILogService);
    private logAction;
    globalSearch(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    adminSearch(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
