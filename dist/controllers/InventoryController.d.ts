import { Request, Response } from "express";
import { IInventoryService } from "../services/InventoryService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class Inventories {
    private inventoryService;
    constructor(inventoryService: IInventoryService);
    getMyInventory(req: AuthenticatedRequest, res: Response): Promise<void>;
    getInventory(req: Request, res: Response): Promise<void>;
    getAllInventories(req: Request, res: Response): Promise<void>;
}
