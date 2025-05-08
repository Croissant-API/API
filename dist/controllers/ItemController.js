"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Items = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const ItemValidator_1 = require("../validators/ItemValidator");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const OwnerCheck_1 = require("../middlewares/OwnerCheck");
const uuid_1 = require("uuid");
const describe_1 = require("../decorators/describe");
let Items = class Items {
    constructor(itemService, inventoryService, userService) {
        this.itemService = itemService;
        this.inventoryService = inventoryService;
        this.userService = userService;
    }
    async getAllItems(req, res) {
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
            };
        });
        res.send(filteredItemsMap);
    }
    async getMyItems(req, res) {
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
    async healthCheck(req, res) {
        try {
            await ItemValidator_1.itemIdParamValidator.validate(req.params);
        }
        catch (error) {
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
    async createItem(req, res) {
        try {
            await ItemValidator_1.createItemValidator.validate(req.body);
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            return res.status(400).send({ message: "Invalid item data", error: message });
        }
        const itemId = (0, uuid_1.v4)();
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
        }
        catch (error) {
            console.error("Error creating item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating item", error: message });
        }
    }
    async updateItem(req, res) {
        try {
            await ItemValidator_1.itemIdParamValidator.validate(req.params);
            await ItemValidator_1.updateItemValidator.validate(req.body);
        }
        catch (error) {
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
        }
        catch (error) {
            console.error("Error updating item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error updating item", error: message });
        }
    }
    async deleteItem(req, res) {
        try {
            await ItemValidator_1.itemIdParamValidator.validate(req.params);
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            return res.status(400).send({ message: "Invalid itemId", error: message });
        }
        const { itemId } = req.params;
        try {
            await this.itemService.deleteItem(itemId);
            res.status(200).send({ message: "Item deleted" });
        }
        catch (error) {
            console.error("Error deleting item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error deleting item", error: message });
        }
    }
    async buyItem(req, res) {
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
            }
            else {
                await this.inventoryService.addItem(user.user_id, itemId, amount);
            }
            res.status(200).send({ message: "Item bought" });
        }
        catch (error) {
            console.error("Error buying item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error buying item", error: message });
        }
    }
    async sellItem(req, res) {
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
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }
            // Only increase balance if the user is NOT the owner
            if (user.user_id !== item.owner) {
                await this.userService.updateUserBalance(user.user_id, user.balance + (item.price * amount * 0.75));
            }
            await this.inventoryService.removeItem(user.user_id, itemId, amount);
            res.status(200).send({ message: "Item sold" });
        }
        catch (error) {
            console.error("Error selling item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error selling item", error: message });
        }
    }
    async giveItem(req, res) {
        const { itemId } = req.params;
        const { amount } = req.body;
        if (!itemId || isNaN(amount)) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const user = req?.user;
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }
            const currentAmount = await this.inventoryService.getItemAmount(user.user_id, itemId);
            if (currentAmount) {
                // L'utilisateur a déjà cet item, on augmente la quantité
                await this.inventoryService.setItemAmount(user.user_id, itemId, currentAmount + amount);
            }
            else {
                // L'utilisateur n'a pas cet item, on l'ajoute
                await this.inventoryService.addItem(user.user_id, itemId, amount);
            }
            res.status(200).send({ message: "Item given" });
        }
        catch (error) {
            console.error("Error giving item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error giving item", error: message });
        }
    }
    async consumeItem(req, res) {
        const { itemId } = req.params;
        const { amount } = req.body;
        if (!itemId || isNaN(amount)) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const user = req?.user;
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }
            await this.inventoryService.removeItem(user.user_id, itemId, amount);
            res.status(200).send({ message: "Item consumed" });
        }
        catch (error) {
            console.error("Error consuming item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error consuming item", error: message });
        }
    }
    async dropItem(req, res) {
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
        }
        catch (error) {
            console.error("Error dropping item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error dropping item", error: message });
        }
    }
    async transferItem(req, res) {
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
            }
            else {
                await this.inventoryService.addItem(targetUserId, itemId, Number(amount));
            }
            res.status(200).send({ message: "Item transferred" });
        }
        catch (error) {
            console.error("Error transferring item", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error transferring item", error: message });
        }
    }
};
__decorate([
    (0, describe_1.describe)({
        endpoint: "/items",
        method: "GET",
        description: "Get all non-deleted items",
        responseType: { items: [{ itemId: "string", name: "string", description: "string", owner: "string", price: "number", iconHash: "string" }] },
        example: "GET /api/items"
    }),
    (0, inversify_express_utils_1.httpGet)("/"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "getAllItems", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/items/@mine",
        method: "GET",
        description: "Get all items owned by the authenticated user. Requires authentication via header \"Authorization: Bearer <token>\".",
        responseType: { items: [{ itemId: "string", name: "string", description: "string", owner: "string", price: "number", iconHash: "string", showInStore: "boolean" }] },
        example: "GET /api/items/@mine"
    }),
    (0, inversify_express_utils_1.httpGet)("/@mine", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "getMyItems", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/items/:itemId",
        method: "GET",
        description: "Get a single item by itemId",
        params: { itemId: "The id of the item" },
        responseType: { name: "string", description: "string", owner: "string", price: "number", showInStore: "boolean", iconHash: "string" },
        example: "GET /api/items/123"
    }),
    (0, inversify_express_utils_1.httpGet)("/:itemId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "healthCheck", null);
__decorate([
    (0, describe_1.describe)({
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
        responseType: { message: "string" },
        example: "POST /api/items/create {\"name\": \"Apple\", \"description\": \"A fruit\", \"price\": 100, \"iconHash\": \"abc123\", \"showInStore\": true}"
    }),
    (0, inversify_express_utils_1.httpPost)("/create", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "createItem", null);
__decorate([
    (0, describe_1.describe)({
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
        responseType: { message: "string" },
        example: "PUT /api/items/update/123 {\"name\": \"Apple\", \"description\": \"A fruit\", \"price\": 100, \"iconHash\": \"abc123\", \"showInStore\": true}"
    }),
    (0, inversify_express_utils_1.httpPut)("/update/:itemId", OwnerCheck_1.OwnerCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "updateItem", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/items/delete/:itemId",
        method: "DELETE",
        description: "Delete an item. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        responseType: { message: "string" },
        example: "DELETE /api/items/delete/123"
    }),
    (0, inversify_express_utils_1.httpDelete)("/delete/:itemId", OwnerCheck_1.OwnerCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "deleteItem", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/items/buy/:itemId",
        method: "POST",
        description: "Buy an item. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: { amount: "The amount of the item to buy" },
        responseType: { message: "string" },
        example: "POST /api/items/buy/item_1 {\"amount\": 2}"
    }),
    (0, inversify_express_utils_1.httpPost)("/buy/:itemId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "buyItem", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/items/sell/:itemId",
        method: "POST",
        description: "Sell an item. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: { amount: "The amount of the item to sell" },
        responseType: { message: "string" },
        example: "POST /api/items/sell/item_1 {\"amount\": 1}"
    }),
    (0, inversify_express_utils_1.httpPost)("/sell/:itemId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "sellItem", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/items/give/:itemId",
        method: "POST",
        description: "Give item occurrences to a user (owner only). Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: { amount: "The amount of the item to give" },
        responseType: { message: "string" },
        example: "POST /api/items/give/item_1 {\"amount\": 1}"
    }),
    (0, inversify_express_utils_1.httpPost)("/give/:itemId", OwnerCheck_1.OwnerCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "giveItem", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/items/consume/:itemId",
        method: "POST",
        description: "Consume item occurrences from a user (owner only). Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: { amount: "The amount of the item to consume" },
        responseType: { message: "string" },
        example: "POST /api/items/consume/item_1 {\"amount\": 1}"
    }),
    (0, inversify_express_utils_1.httpPost)("/consume/:itemId", OwnerCheck_1.OwnerCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "consumeItem", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/items/drop/:itemId",
        method: "POST",
        description: "Drop item occurrences from your inventory. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: { amount: "The amount of the item to drop" },
        responseType: { message: "string" },
        example: "POST /api/items/drop/item_1 {\"amount\": 1}"
    }),
    (0, inversify_express_utils_1.httpPost)("/drop/:itemId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "dropItem", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/items/transfer/:itemId",
        method: "POST",
        description: "Transfer item occurrences to another user. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { itemId: "The id of the item" },
        body: {
            amount: "The amount of the item to transfer",
            targetUserId: "The user ID of the recipient"
        },
        responseType: { message: "string" },
        example: "POST /api/items/transfer/item_1 {\"amount\": 1, \"targetUserId\": \"user_2\"}"
    }),
    (0, inversify_express_utils_1.httpPost)("/transfer/:itemId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "transferItem", null);
Items = __decorate([
    (0, inversify_express_utils_1.controller)("/items"),
    __param(0, (0, inversify_1.inject)("ItemService")),
    __param(1, (0, inversify_1.inject)("InventoryService")),
    __param(2, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object, Object, Object])
], Items);
exports.Items = Items;
