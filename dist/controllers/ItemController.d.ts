import { Request, Response } from 'express';
import { IItemService } from '../services/ItemService';
import { IInventoryService } from '../services/InventoryService';
import { IUserService } from '../services/UserService';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
import { AuthenticatedRequestWithOwner } from '../middlewares/OwnerCheck';
export declare class ItemController {
    private itemService;
    private inventoryService;
    private userService;
    constructor(itemService: IItemService, inventoryService: IInventoryService, userService: IUserService);
    getAllItems(req: Request, res: Response): Promise<void>;
    healthCheck(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createItem(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    updateItem(req: AuthenticatedRequestWithOwner, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    deleteItem(req: AuthenticatedRequestWithOwner, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    buyItem(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    sellItem(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    giveItem(req: AuthenticatedRequestWithOwner, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    consumeItem(req: AuthenticatedRequestWithOwner, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
