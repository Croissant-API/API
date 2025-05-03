import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpDelete, httpGet, httpPost, httpPut } from "inversify-express-utils";
import { IItemService } from '../services/ItemService';
import { createItemValidator, updateItemValidator, itemIdParamValidator } from '../validators/ItemValidator';
import { IInventoryService } from '../services/InventoryService';
import { IUserService } from '../services/UserService';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { AuthenticatedRequestWithOwner, OwnerCheck } from '../middlewares/OwnerCheck';

@controller("/api/items")
export class ItemController {
    constructor(
        @inject("ItemService") private itemService: IItemService,
        @inject("InventoryService") private inventoryService: IInventoryService,
        @inject("UserService") private userService: IUserService,
    ) {}

    @httpGet("/")
    public async getAllItems(req: Request, res: Response) {
        const items = await this.itemService.getAllItems();
        const filteredItems = items.filter(item => !item.deleted);
        const filteredItemsMap = filteredItems.map(item => {
            return {
                "itemId": item.itemId,
                "name": item.name,
                "description": item.description,
                "owner": item.owner,
                "price": item.price,
                "showInStore": 1,
            }
        });
        res.send(filteredItemsMap);
    }

    @httpGet("/:itemId")
    public async healthCheck(req: Request, res: Response) {
        try {
            await itemIdParamValidator.validate(req.params);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            return res.status(400).send({ message: "Invalid itemId", error: message });
        }
        const { itemId } = req.params;
        const item = await this.itemService.getItem(itemId);
        if (!item || item.deleted) {
            return res.status(404).send({ message: "Item not found" });
        }
        const filteredItem = {
            name: item.name,
            description: item.description,
            owner: item.owner,
            price: item.price,
            showInStore: 1,
        };
        res.send(filteredItem);
    }

    @httpPost("/create", LoggedCheck.middleware)
    public async createItem(req: AuthenticatedRequest, res: Response) {
        try {
            await createItemValidator.validate(req.body);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            return res.status(400).send({ message: "Invalid item data", error: message });
        }
        const { itemId, name, description, price } = req.body;
        try {
            await this.itemService.createItem(itemId, name, description, price, req.user.user_id).then(() => {
                res.status(200).send({ message: "Item created" });
            }).catch((error) => {
                console.error("Error creating item", error);
                const message = (error instanceof Error) ? error.message : String(error);
                res.status(500).send({ message: "Error creating item", error: message });
            });
        } catch (error) {
            console.error("Error creating item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating item", error: message });
        }
    }

    @httpPut("/update/:itemId", OwnerCheck.middleware)
    public async updateItem(req: AuthenticatedRequestWithOwner, res: Response) {
        try {
            await itemIdParamValidator.validate(req.params);
            await updateItemValidator.validate(req.body);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            return res.status(400).send({ message: "Invalid update data", error: message });
        }
        const { itemId } = req.params;
        const { name, description, price } = req.body;
        try {
            await this.itemService.updateItem(itemId, name, description, price);
            res.status(200).send({ message: "Item updated" });
        } catch (error) {
            console.error("Error updating item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error updating item", error: message });
        }
    }

    @httpDelete("/delete/:itemId", OwnerCheck.middleware)
    public async deleteItem(req: AuthenticatedRequestWithOwner, res: Response) {
        try {
            await itemIdParamValidator.validate(req.params);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            return res.status(400).send({ message: "Invalid itemId", error: message });
        }
        const { itemId } = req.params;
        try {
            await this.itemService.deleteItem(itemId);
            res.status(200).send({ message: "Item deleted" });
        } catch (error) {
            console.error("Error deleting item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error deleting item", error: message });
        }
    }

    @httpPost("/buy/:itemId", LoggedCheck.middleware)
    public async buyItem(req: AuthenticatedRequest, res: Response) {
        const { itemId, amount } = req.body;
        if (!itemId || isNaN(amount)) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const item = await this.itemService.getItem(itemId);
            if (!item || item.deleted) {
                return res.status(404).send({ message: "Item not found" });
            }

            const user = req.user;
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }

            if (user.balance < item.price * amount) {
                return res.status(400).send({ message: "Insufficient balance" });
            }

            await this.userService.updateUserBalance(user.user_id, user.balance - item.price * amount);
            await this.inventoryService.addItem(user.user_id, itemId, amount);

            res.status(200).send({ message: "Item bought" });
        } catch (error) {
            console.error("Error buying item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error buying item", error: message });
        }
    }

    @httpPost("/sell/:itemId", LoggedCheck.middleware)
    public async sellItem(req: AuthenticatedRequest, res: Response) {
        const { itemId, amount } = req.body;
        if (!itemId || isNaN(amount)) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const item = await this.itemService.getItem(itemId);
            if (!item || item.deleted) {
                return res.status(404).send({ message: "Item not found" });
            }

            const user = req.user;
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }

            await this.userService.updateUserBalance(user.user_id, user.balance + (item.price * amount * 0.75));
            await this.inventoryService.removeItem(user.user_id, itemId, amount);

            res.status(200).send({ message: "Item sold" });
        } catch (error) {
            console.error("Error selling item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error selling item", error: message });
        }
    }

    @httpPost("/give/:itemId", OwnerCheck.middleware)
    public async giveItem(req: AuthenticatedRequestWithOwner, res: Response) {
        const { itemId, amount } = req.body;
        if (!itemId || isNaN(amount)) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const user = req?.user;
            if(!user) {
                return res.status(404).send({ message: "User not found" });
            }
            await this.inventoryService.addItem(user.user_id, itemId, amount);

            res.status(200).send({ message: "Item given" });
        } catch (error) {
            console.error("Error giving item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error giving item", error: message });
        }
    }

    @httpPost("/consume/:itemId", OwnerCheck.middleware)
    public async consumeItem(req: AuthenticatedRequestWithOwner, res: Response) {
        const { itemId, amount } = req.body;
        if (!itemId || isNaN(amount)) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const user = req?.user;
            if(!user) {
                return res.status(404).send({ message: "User not found" });
            }

            await this.inventoryService.removeItem(user.user_id, itemId, amount);

            res.status(200).send({ message: "Item consumed" });
        } catch (error) {
            console.error("Error consuming item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error consuming item", error: message });
        }
    }
}