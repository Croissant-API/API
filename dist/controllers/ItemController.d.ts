import { Request, Response } from "express";
import { IItemService } from "../services/ItemService";
import { IInventoryService } from "../services/InventoryService";
import { IUserService } from "../services/UserService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { AuthenticatedRequestWithOwner } from "../middlewares/OwnerCheck";
export declare class Items {
    private itemService;
    private inventoryService;
    private userService;
    constructor(itemService: IItemService, inventoryService: IInventoryService, userService: IUserService);
    getAllItems(req: Request, res: Response): Promise<void>;
    getMyItems(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    searchItems(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    healthCheck(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    createItem(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateItem(req: AuthenticatedRequestWithOwner, res: Response): Promise<void>;
    deleteItem(req: AuthenticatedRequestWithOwner, res: Response): Promise<void>;
    buyItem(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    sellItem(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    giveItem(req: AuthenticatedRequestWithOwner, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    consumeItem(req: AuthenticatedRequestWithOwner, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    dropItem(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    transferItem(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    transferOwnership(req: AuthenticatedRequestWithOwner, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
