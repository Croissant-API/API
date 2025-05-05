import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet } from "inversify-express-utils";
import { IInventoryService } from '../services/InventoryService';
import { IItemService } from '../services/ItemService';
import { userIdParamSchema } from '../validators/InventoryValidator';
import { describe } from '../decorators/describe';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';

@controller("/inventory")
export class Inventories {
    constructor(
        @inject("InventoryService") private inventoryService: IInventoryService,
        @inject("ItemService") private itemService: IItemService,
    ) {}

    @httpGet("/")
    public async getAllInventories(req: Request, res: Response) {
        res.send({ message: "Please specify /api/inventory/<userId>" });
    }

    @httpGet("/@me", LoggedCheck.middleware)
    public async getMyInventory(req: AuthenticatedRequest, res: Response) {
        const userId = req.user.user_id; // Assuming you have middleware that sets req.userId
        try {
            const { inventory } = await this.inventoryService.getInventory(userId);
            const filteredInventory = (
                await Promise.all(
                    inventory.map(async (item) => {
                        const itemDetails = await this.itemService.getItem(item.item_id);
                        if (!itemDetails || itemDetails.deleted) {
                            return null; // Skip deleted items
                        }
                        return {
                            itemId: itemDetails.itemId,
                            name: itemDetails.name,
                            description: itemDetails.description,
                            amount: item.amount,
                        };
                    })
                )
            ).filter(Boolean); // Remove nulls
            res.send(filteredInventory);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching inventory", error: message });
        }
    }

    @describe({
        endpoint: "/inventory/:userId",
        method: "GET",
        description: "Get the inventory of a user",
        params: { userId: "The id of the user" },
        responseType: "array[object{itemId: string, name: string, description: string, amount: number}]",
        example: "GET /api/inventory/123"
    })
    @httpGet("/:userId")
    public async getInventory(req: Request, res: Response) {
        try {
            await userIdParamSchema.validate({ userId: req.params.userId });
        } catch (err) {
            return res.status(400).send({ message: err instanceof Error ? err.message : String(err) });
        }
        const userId = req.params.userId;
        try {
            const { inventory } = await this.inventoryService.getInventory(userId);
            const filteredInventory = (
                await Promise.all(
                    inventory.map(async (item) => {
                        const itemDetails = await this.itemService.getItem(item.item_id);
                        if (!itemDetails || itemDetails.deleted) {
                            return null; // Skip deleted items
                        }
                        return {
                            itemId: itemDetails.itemId,
                            name: itemDetails.name,
                            description: itemDetails.description,
                            amount: item.amount,
                        };
                    })
                )
            ).filter(Boolean); // Remove nulls
            res.send(filteredInventory);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching inventory", error: message });
        }
    }
}
