import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut } from "inversify-express-utils";
import { IInventoryService } from '../services/InventoryService';
import { IItemService } from '../services/ItemService';
import {
    userIdParamSchema,
    addItemSchema,
    removeItemSchema,
    setItemAmountSchema
} from '../validators/InventoryValidator';
import { describe } from '../decorators/describe';

@controller("/inventory")
export class InventoryController {
    constructor(
        @inject("InventoryService") private inventoryService: IInventoryService,
        @inject("ItemService") private itemService: IItemService,
    ) {}

    @describe({
        endpoint: "/inventory",
        method: "GET",
        description: "Prompt to specify a userId for inventory lookup",
        responseType: "object{message: string}",
        example: "GET /api/inventory"
    })
    @httpGet("/")
    public async getAllInventories(req: Request, res: Response) {
        res.send({ message: "Please specify /api/inventory/<userId>" });
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

    @describe({
        endpoint: "/inventory/:userId/add",
        method: "POST",
        description: "Add an item to a user's inventory",
        params: { userId: "The id of the user" },
        body: {
            itemId: "The id of the item to add",
            amount: "The amount of the item to add"
        },
        responseType: "object{message: string}",
        example: "POST /api/inventory/123/add {\"itemId\": \"item_1\", \"amount\": 2}"
    })
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

    @describe({
        endpoint: "/inventory/:userId/remove",
        method: "POST",
        description: "Remove an item from a user's inventory",
        params: { userId: "The id of the user" },
        body: {
            itemId: "The id of the item to remove",
            amount: "The amount of the item to remove"
        },
        responseType: "object{message: string}",
        example: "POST /api/inventory/123/remove {\"itemId\": \"item_1\", \"amount\": 1}"
    })
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

    @describe({
        endpoint: "/inventory/:userId/set",
        method: "PUT",
        description: "Set the amount of an item in a user's inventory",
        params: { userId: "The id of the user" },
        body: {
            itemId: "The id of the item to set",
            amount: "The new amount of the item"
        },
        responseType: "object{message: string}",
        example: "PUT /api/inventory/123/set {\"itemId\": \"item_1\", \"amount\": 5}"
    })
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
