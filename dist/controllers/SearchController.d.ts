import type { Request, Response } from 'express';
import { IGameService } from '../services/GameService';
import { IInventoryService } from '../services/InventoryService';
import { IItemService } from '../services/ItemService';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
export declare class SearchController {
    private userService;
    private itemService;
    private gameService;
    private inventoryService;
    private logService;
    constructor(userService: IUserService, itemService: IItemService, gameService: IGameService, inventoryService: IInventoryService, logService: ILogService);
    private createLog;
    private handleSearch;
    globalSearch(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
