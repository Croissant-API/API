import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpDelete, httpGet, httpPost, httpPut } from "inversify-express-utils";
import { IItemService } from '../services/ItemService';
import { createItemValidator, updateItemValidator, itemIdParamValidator } from '../validators/ItemValidator';
import { IInventoryService } from '../services/InventoryService';
import { IUserService } from '../services/UserService';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { AuthenticatedRequestWithOwner, OwnerCheck } from '../middlewares/OwnerCheck';
import { v4 } from 'uuid';
import { describe } from '../decorators/describe';

@controller("/items")
export class Items {
    constructor(
        @inject("ItemService") private itemService: IItemService,
        @inject("InventoryService") private inventoryService: IInventoryService,
        @inject("UserService") private userService: IUserService,
    ) {}

    @describe({
        endpoint: "/items",
        method: "GET",
        description: "Get all non-deleted items",
        responseType: [{itemId: "string", name: "string", description: "string", owner: "string", price: "number", iconHash: "string"}],
        example: "GET /api/items"
    })
    @httpGet("/")
    public async getAllItems(req: Request, res: Response) {
        const items = await this.itemService.getAllItems();
        const filteredItems = items.filter(item => !item.deleted && item.showInStore);
        const filteredItemsMap = filteredItems.map(item => {
            return {
                "itemId": item.itemId,
                "name": item.name,
                "description": item.description,
                "owner": item.owner,
                "price": item.price,
                "iconHash": item.iconHash,
            }
        });
        res.send(filteredItemsMap);
    }

    @describe({
        endpoint: "/items/@mine",
        method: "GET",
        description: "Get all items owned by the authenticated user. Requires authentication via header \"Authorization: Bearer <token>\".",
        responseType: [{itemId: "string", name: "string", description: "string", owner: "string", price: "number", iconHash: "string", showInStore: "boolean"}],
        example: "GET /api/items/@mine"
    })
    @httpGet("/@mine", LoggedCheck.middleware)
    public async getMyItems(req: AuthenticatedRequest, res: Response) {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const items = await this.itemService.getAllItems();
        const myItems = items.filter(item => !item.deleted && item.owner === userId);
        const myItemsMap = myItems.map(item => ({
            itemId: item.itemId,
            name: item.name,
            description: item.description,
            owner: item.owner,
            price: item.price,
            iconHash: item.iconHash,
            showInStore: item.showInStore,
        }));
        res.send(myItemsMap);
    }

    @describe({
        endpoint: "/items/:itemId",
        method: "GET",
        description: "Get a single item by itemId",
        params: { itemId: "The id of the item" },
        responseType: {name: "string", description: "string", owner: "string", price: "number", showInStore: "boolean", iconHash: "string"},
        example: "GET /api/items/123"
    })
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
            showInStore: item.showInStore,
            iconHash: item.iconHash,
        };
        res.send(filteredItem);
    }

    @describe({
        endpoint: "/items/create",
        method: "POST",
        description: "Create a new item. Requires authentication via header \"Authorization: Bearer <token>\".",
        body: {
            name: "Name of the item",
            description: "Description of the item",
            price: "Price of the item",
            iconHash: "Hash of the icon (optional)",
            showInStore: "Show in store (optional, boolean)"
        },
        responseType: {message: "string"},
        example: "POST /api/items/create {\"name\": \"Apple\", \"description\": \"A fruit\", \"price\": 100, \"iconHash\": \"abc123\", \"showInStore\": true}"
    })
    @httpPost("/create", LoggedCheck.middleware)
    public async createItem(req: AuthenticatedRequest, res: Response) {
        try {
            await createItemValidator.validate(req.body);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            return res.status(400).send({ message: "Invalid item data", error: message });
        }
        const itemId = v4();
        const { name, description, price, iconHash, showInStore } = req.body;
        try {
            await this.itemService.createItem({
                itemId,
                name: name ?? null,
                description: description ?? null,
                price: price ?? 0,
                owner: req.user.user_id,
                iconHash: iconHash ?? null,
                showInStore: showInStore ?? false,
                deleted: false
            });
            res.status(200).send({ message: "Item created" });
        } catch (error) {
            console.error("Error creating item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating item", error: message });
        }
    }

    @describe({
        endpoint: "/items/update/:itemId",
        method: "PUT",
        description: "Update an existing item. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: {
            name: "Name of the item",
            description: "Description of the item",
            price: "Price of the item",
            iconHash: "Hash of the icon (optional)",
            showInStore: "Show in store (optional, boolean)"
        },
        responseType: {message: "string"},
        example: "PUT /api/items/update/123 {\"name\": \"Apple\", \"description\": \"A fruit\", \"price\": 100, \"iconHash\": \"abc123\", \"showInStore\": true}"
    })
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
        const { name, description, price, iconHash, showInStore } = req.body;
        try {
            await this.itemService.updateItem(itemId, {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(price !== undefined && { price }),
                ...(iconHash !== undefined && { iconHash }),
                ...(showInStore !== undefined && { showInStore })
            });
            res.status(200).send({ message: "Item updated" });
        } catch (error) {
            console.error("Error updating item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error updating item", error: message });
        }
    }

    @describe({
        endpoint: "/items/delete/:itemId",
        method: "DELETE",
        description: "Delete an item. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        responseType: {message: "string"},
        example: "DELETE /api/items/delete/123"
    })
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

    @describe({
        endpoint: "/items/buy/:itemId",
        method: "POST",
        description: "Buy an item. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: { amount: "The amount of the item to buy" },
        responseType: {message: "string"},
        example: "POST /api/items/buy/item_1 {\"amount\": 2}"
    })
    @httpPost("/buy/:itemId", LoggedCheck.middleware)
    public async buyItem(req: AuthenticatedRequest, res: Response) {
        const { itemId } = req.params;
        const { amount } = req.body;
        if (!itemId || isNaN(amount)) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const item = await this.itemService.getItem(itemId);
            if (!item || item.deleted) {
                return res.status(404).send({ message: "Item not found" });
            }

            const user = req.user;
            const owner = await this.userService.getUser(item.owner);
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }
            if (!owner) {
                return res.status(404).send({ message: "Owner not found" });
            }

            // Only check and update balance if the user is NOT the owner
            if (user.user_id !== item.owner) {
                if (user.balance < item.price * amount) {
                    return res.status(400).send({ message: "Insufficient balance" });
                }
                await this.userService.updateUserBalance(user.user_id, user.balance - item.price * amount);
                await this.userService.updateUserBalance(owner.user_id, owner.balance + (item.price * amount) * 0.75);
            }
            // If user is owner, skip balance check and update

            const currentAmount = await this.inventoryService.getItemAmount(user.user_id, itemId);
            if (currentAmount) {
                await this.inventoryService.setItemAmount(user.user_id, itemId, currentAmount + amount);
            } else {
                await this.inventoryService.addItem(user.user_id, itemId, amount);
            }

            res.status(200).send({ message: "Item bought" });
        } catch (error) {
            console.error("Error buying item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error buying item", error: message });
        }
    }

    @describe({
        endpoint: "/items/sell/:itemId",
        method: "POST",
        description: "Sell an item. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: { amount: "The amount of the item to sell" },
        responseType: {message: "string"},
        example: "POST /api/items/sell/item_1 {\"amount\": 1}"
    })
    @httpPost("/sell/:itemId", LoggedCheck.middleware)
    public async sellItem(req: AuthenticatedRequest, res: Response) {
        const {itemId} = req.params;
        const { amount } = req.body;
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

            // Only increase balance if the user is NOT the owner
            if (user.user_id !== item.owner) {
                await this.userService.updateUserBalance(user.user_id, user.balance + (item.price * amount * 0.75));
            }
            await this.inventoryService.removeItem(user.user_id, itemId, amount);

            res.status(200).send({ message: "Item sold" });
        } catch (error) {
            console.error("Error selling item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error selling item", error: message });
        }
    }

    @describe({
        endpoint: "/items/give/:itemId",
        method: "POST",
        description: "Give item occurrences to a user (owner only). Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: { amount: "The amount of the item to give" },
        responseType: {message: "string"},
        example: "POST /api/items/give/item_1 {\"amount\": 1}"
    })
    @httpPost("/give/:itemId", OwnerCheck.middleware)
    public async giveItem(req: AuthenticatedRequestWithOwner, res: Response) {
        const { itemId } = req.params;
        const { amount } = req.body;
        if (!itemId || isNaN(amount)) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const user = req?.user;
            if(!user) {
                return res.status(404).send({ message: "User not found" });
            }

            const currentAmount = await this.inventoryService.getItemAmount(user.user_id, itemId);
            if (currentAmount) {
                // L'utilisateur a déjà cet item, on augmente la quantité
                await this.inventoryService.setItemAmount(user.user_id, itemId, currentAmount + amount);
            } else {
                // L'utilisateur n'a pas cet item, on l'ajoute
                await this.inventoryService.addItem(user.user_id, itemId, amount);
            }

            res.status(200).send({ message: "Item given" });
        } catch (error) {
            console.error("Error giving item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error giving item", error: message });
        }
    }

    @describe({
        endpoint: "/items/consume/:itemId",
        method: "POST",
        description: "Consume item occurrences from a user (owner only). Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: { amount: "The amount of the item to consume" },
        responseType: {message: "string"},
        example: "POST /api/items/consume/item_1 {\"amount\": 1}"
    })
    @httpPost("/consume/:itemId", OwnerCheck.middleware)
    public async consumeItem(req: AuthenticatedRequestWithOwner, res: Response) {
        const { itemId } = req.params;
        const { amount } = req.body;
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

    @describe({
        endpoint: "/items/drop/:itemId",
        method: "POST",
        description: "Drop item occurrences from your inventory. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: { amount: "The amount of the item to drop" },
        responseType: {message: "string"},
        example: "POST /api/items/drop/item_1 {\"amount\": 1}"
    })
    @httpPost("/drop/:itemId", LoggedCheck.middleware)
    public async dropItem(req: AuthenticatedRequest, res: Response) {
        const { itemId } = req.params;
        const { amount } = req.body;
        if (!itemId || isNaN(amount)) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const user = req.user;
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }
            await this.inventoryService.removeItem(user.user_id, itemId, amount);
            res.status(200).send({ message: "Item dropped" });
        } catch (error) {
            console.error("Error dropping item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error dropping item", error: message });
        }
    }

    @describe({
        endpoint: "/items/transfer/:itemId",
        method: "POST",
        description: "Transfer item occurrences to another user. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: {
            amount: "The amount of the item to transfer",
            targetUserId: "The user ID of the recipient"
        },
        responseType: {message: "string"},
        example: "POST /api/items/transfer/item_1 {\"amount\": 1, \"targetUserId\": \"user_2\"}"
    })
    @httpPost("/transfer/:itemId", LoggedCheck.middleware)
    public async transferItem(req: AuthenticatedRequest, res: Response) {
        const { itemId } = req.params;
        const { amount, targetUserId } = req.body;
        if (!itemId || isNaN(amount) || amount <= 0 || !targetUserId) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const user = req.user;
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }
            if (user.user_id === targetUserId) {
                return res.status(400).send({ message: "Cannot transfer to yourself" });
            }

            // Check sender inventory
            const senderAmount = await this.inventoryService.getItemAmount(user.user_id, itemId);
            if (!senderAmount || senderAmount < amount) {
                return res.status(400).send({ message: "Not enough items to transfer" });
            }

            // Remove from sender
            await this.inventoryService.removeItem(user.user_id, itemId, amount);

            // Add to recipient
            const recipientAmount = await this.inventoryService.getItemAmount(targetUserId, itemId);
            if (recipientAmount) {
                await this.inventoryService.setItemAmount(targetUserId, itemId, recipientAmount + Number(amount));
            } else {
                await this.inventoryService.addItem(targetUserId, itemId, Number(amount));
            }

            res.status(200).send({ message: "Item transferred" });
        } catch (error) {
            console.error("Error transferring item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error transferring item", error: message });
        }
    }
}