import { Request, Response } from "express";
import { IUserService } from "../services/UserService";
import { IItemService } from "../services/ItemService";
import { IGameService } from "../services/GameService";
import { IInventoryService } from "../services/InventoryService";
export declare class SearchController {
    private userService;
    private itemService;
    private gameService;
    private inventoryService;
    constructor(userService: IUserService, itemService: IItemService, gameService: IGameService, inventoryService: IInventoryService);
    globalSearch(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
