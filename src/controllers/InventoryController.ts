import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut } from "inversify-express-utils";
import { IInventoryService } from '../services/InventoryService';
import { IItemService } from 'services/ItemService';
import {
    userIdParamSchema,
    addItemSchema,
    removeItemSchema,
    setItemAmountSchema
} from '../validators/InventoryValidator';

@controller("/api/inventory")
export class InventoryController {
    constructor(
        @inject("InventoryService") private inventoryService: IInventoryService,
        @inject("ItemService") private itemService: IItemService,
    ) {}

    @httpGet("/")
    public async getAllInventories(req: Request, res: Response) {
        res.send({ message: "Please specify /api/inventory/<userId>" });
    }

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

    @httpPost("/:userId/add")
    public async addItem(req: Request, res: Response) {
        try {
            await userIdParamSchema.validate({ userId: req.params.userId });
            await addItemSchema.validate(req.body);
        } catch (err) {
            return res.status(400).send({ message: err instanceof Error ? err.message : String(err) });
        }
        const userId = req.params.userId;
        const { itemId, amount } = req.body;
        try {
            await this.inventoryService.addItem(userId, itemId, Number(amount));
            res.status(200).send({ message: "Item added" });
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error adding item", error: message });
        }
    }

    @httpPost("/:userId/remove")
    public async removeItem(req: Request, res: Response) {
        try {
            await userIdParamSchema.validate({ userId: req.params.userId });
            await removeItemSchema.validate(req.body);
        } catch (err) {
            return res.status(400).send({ message: err instanceof Error ? err.message : String(err) });
        }
        const userId = req.params.userId;
        const { itemId, amount } = req.body;
        try {
            await this.inventoryService.removeItem(userId, itemId, Number(amount));
            res.status(200).send({ message: "Item removed" });
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error removing item", error: message });
        }
    }

    @httpPut("/:userId/set")
    public async setItemAmount(req: Request, res: Response) {
        try {
            await userIdParamSchema.validate({ userId: req.params.userId });
            await setItemAmountSchema.validate(req.body);
        } catch (err) {
            return res.status(400).send({ message: err instanceof Error ? err.message : String(err) });
        }
        const userId = req.params.userId;
        const { itemId, amount } = req.body;
        try {
            await this.inventoryService.setItemAmount(userId, itemId, Number(amount));
            res.status(200).send({ message: "Item amount set" });
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error setting item amount", error: message });
        }
    }
}
