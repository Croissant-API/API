import { Request, Response } from "express";
import { IInventoryService } from "../services/InventoryService";
import { IItemService } from "../services/ItemService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class Inventories {
    private inventoryService;
    private itemService;
    constructor(inventoryService: IInventoryService, itemService: IItemService);
    getMyInventory(req: AuthenticatedRequest, res: Response): Promise<void>;
    getInventory(req: Request, res: Response): Promise<void>;
    getAllInventories(req: Request, res: Response): Promise<void>;
}
