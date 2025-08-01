import { Request, Response } from "express";
import { IInventoryService } from "../services/InventoryService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { ILogService } from "../services/LogService";
export declare class Inventories {
    private inventoryService;
    private logService;
    constructor(inventoryService: IInventoryService, logService: ILogService);
    private createLog;
    getMyInventory(req: AuthenticatedRequest, res: Response): Promise<void>;
    getInventory(req: Request, res: Response): Promise<void>;
    getAllInventories(req: Request, res: Response): Promise<void>;
}
