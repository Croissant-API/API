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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Items = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const uuid_1 = require("uuid");
const yup_1 = require("yup");
const describe_1 = require("../decorators/describe");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const OwnerCheck_1 = require("../middlewares/OwnerCheck");
const ItemValidator_1 = require("../validators/ItemValidator");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
async function validateOr400(schema, data, res, message = 'Invalid data') {
    try {
        await schema.validate(data);
        return true;
    }
    catch (error) {
        if (error instanceof yup_1.ValidationError) {
            res.status(400).send({ message, errors: error.errors });
            return false;
        }
        throw error;
    }
}
const createItemRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: 'Too many item creations, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const updateItemRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: 'Too many item updates, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const deleteItemRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: 'Too many item deletions, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const buyItemRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 200,
    message: 'Too many item purchases, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const sellItemRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 200,
    message: 'Too many item sales, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const consumeItemRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 1000,
    message: 'Too many item consumptions, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const dropItemRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 1000,
    message: 'Too many item drops, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const transferOwnershipRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 500,
    message: 'Too many ownership transfers, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
let Items = class Items {
    constructor(itemService, inventoryService, userService, logService) {
        this.itemService = itemService;
        this.inventoryService = inventoryService;
        this.userService = userService;
        this.logService = logService;
    }
    async createLog(req, tableName, statusCode, userId, metadata) {
        try {
            const requestBody = { ...req.body };
            if (metadata)
                requestBody.metadata = metadata;
            await this.logService.createLog({
                ip_address: req.headers['x-real-ip'] || req.socket.remoteAddress,
                table_name: tableName,
                controller: 'ItemController',
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: userId ?? req.user?.user_id,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    async getAllItems(req, res) {
        try {
            const items = await this.itemService.getStoreItems();
            await this.createLog(req, 'items', 200, undefined, { items_count: items.length });
            res.send(items);
        }
        catch (error) {
            await this.createLog(req, 'items', 500, undefined, { error: error instanceof Error ? error.message : String(error) });
            handleError(res, error, 'Error fetching items');
        }
    }
    async getMyItems(req, res) {
        const userId = req.user?.user_id;
        if (!userId) {
            await this.createLog(req, 'items', 401);
            return res.status(401).send({ message: 'Unauthorized' });
        }
        try {
            const items = await this.itemService.getMyItems(userId);
            await this.createLog(req, 'items', 200, undefined, { owned_items_count: items.length });
            res.send(items);
        }
        catch (error) {
            await this.createLog(req, 'items', 500, undefined, { error: error instanceof Error ? error.message : String(error) });
            handleError(res, error, 'Error fetching your items');
        }
    }
    async searchItems(req, res) {
        const query = req.query.q?.trim();
        if (!query) {
            await this.createLog(req, 'items', 400, undefined, { reason: 'missing_search_query' });
            return res.status(400).send({ message: 'Missing search query' });
        }
        try {
            const items = await this.itemService.searchItemsByName(query);
            await this.createLog(req, 'items', 200, undefined, { search_query: query, results_count: items.length });
            res.send(items);
        }
        catch (error) {
            await this.createLog(req, 'items', 500, undefined, { search_query: query, error: error instanceof Error ? error.message : String(error) });
            handleError(res, error, 'Error searching items');
        }
    }
    async getItem(req, res) {
        if (!(await validateOr400(ItemValidator_1.itemIdParamValidator, req.params, res, 'Invalid itemId'))) {
            await this.createLog(req, 'items', 400);
            return;
        }
        try {
            const { itemId } = req.params;
            const item = await this.itemService.getItem(itemId);
            if (!item || item.deleted) {
                await this.createLog(req, 'items', 404, undefined, { itemId });
                return res.status(404).send({ message: 'Item not found' });
            }
            await this.createLog(req, 'items', 200, undefined, { itemId, item_name: item.name, item_price: item.price });
            res.send({
                itemId: item.itemId,
                name: item.name,
                description: item.description,
                owner: item.owner,
                price: item.price,
                iconHash: item.iconHash,
                showInStore: item.showInStore,
            });
        }
        catch (error) {
            await this.createLog(req, 'items', 500, undefined, { itemId: req.params.itemId, error: error instanceof Error ? error.message : String(error) });
            handleError(res, error, 'Error fetching item');
        }
    }
    async createItem(req, res) {
        if (!(await validateOr400(ItemValidator_1.createItemValidator, req.body, res, 'Invalid item data'))) {
            await this.createLog(req, 'items', 400);
            return;
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
                deleted: false,
            });
            await this.createLog(req, 'items', 201, undefined, { itemId, item_name: name, item_price: price, show_in_store: showInStore });
            res.status(200).send({ message: 'Item created' });
        }
        catch (error) {
            await this.createLog(req, 'items', 500, undefined, { item_name: name, error: error instanceof Error ? error.message : String(error) });
            handleError(res, error, 'Error creating item');
        }
    }
    async updateItem(req, res) {
        if (!(await validateOr400(ItemValidator_1.itemIdParamValidator, req.params, res, 'Invalid itemId'))) {
            await this.createLog(req, 'items', 400);
            return;
        }
        if (!(await validateOr400(ItemValidator_1.updateItemValidator, req.body, res, 'Invalid update data'))) {
            await this.createLog(req, 'items', 400);
            return;
        }
        const { itemId } = req.params;
        const { name, description, price, iconHash, showInStore } = req.body;
        try {
            await this.itemService.updateItem(itemId, {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(price !== undefined && { price }),
                ...(iconHash !== undefined && { iconHash }),
                ...(showInStore !== undefined && { showInStore }),
            });
            await this.createLog(req, 'items', 200, undefined, {
                itemId,
                updated_fields: {
                    name: name !== undefined,
                    description: description !== undefined,
                    price: price !== undefined,
                    iconHash: iconHash !== undefined,
                    showInStore: showInStore !== undefined,
                },
            });
            res.status(200).send({ message: 'Item updated' });
        }
        catch (error) {
            await this.createLog(req, 'items', 500, undefined, { itemId, error: error instanceof Error ? error.message : String(error) });
            handleError(res, error, 'Error updating item');
        }
    }
    async deleteItem(req, res) {
        if (!(await validateOr400(ItemValidator_1.itemIdParamValidator, req.params, res, 'Invalid itemId'))) {
            await this.createLog(req, 'items', 400);
            return;
        }
        const { itemId } = req.params;
        try {
            await this.itemService.deleteItem(itemId);
            await this.createLog(req, 'items', 200, undefined, { itemId, action: 'deleted' });
            res.status(200).send({ message: 'Item deleted' });
        }
        catch (error) {
            await this.createLog(req, 'items', 500, undefined, { itemId, error: error instanceof Error ? error.message : String(error) });
            handleError(res, error, 'Error deleting item');
        }
    }
    async buyItem(req, res) {
        const { itemId } = req.params;
        const { amount } = req.body;
        if (!itemId || isNaN(amount)) {
            await this.createLog(req, 'inventory', 400, req.user?.user_id, { reason: 'invalid_input', itemId, amount });
            return res.status(400).send({ message: 'Invalid input' });
        }
        try {
            const item = await this.itemService.getItem(itemId);
            if (!item || item.deleted) {
                await this.createLog(req, 'inventory', 404, req.user?.user_id, { itemId, action: 'buy' });
                return res.status(404).send({ message: 'Item not found' });
            }
            const user = req.user;
            const owner = await this.userService.getUser(item.owner);
            if (!user || !owner) {
                await this.createLog(req, 'inventory', 404, req.user?.user_id, { itemId, action: 'buy', reason: 'user_or_owner_not_found' });
                return res.status(404).send({ message: 'User or owner not found' });
            }
            const totalCost = item.price * amount;
            const isOwner = user.user_id === item.owner;
            if (!isOwner && user.balance < totalCost) {
                await this.createLog(req, 'inventory', 400, req.user?.user_id, { itemId, action: 'buy', reason: 'insufficient_balance', required: totalCost, available: user.balance });
                return res.status(400).send({ message: 'Insufficient balance' });
            }
            if (!isOwner) {
                await this.userService.updateUserBalance(user.user_id, user.balance - totalCost);
                await this.userService.updateUserBalance(owner.user_id, owner.balance + totalCost * 0.75);
            }
            await this.inventoryService.addItem(user.user_id, itemId, amount, undefined, req.user.user_id != owner.user_id, item.price);
            await this.createLog(req, 'inventory', 200, req.user?.user_id, { itemId, action: 'buy', amount, total_cost: totalCost, is_owner: isOwner, item_name: item.name });
            res.status(200).send({ message: 'Item bought' });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await this.createLog(req, 'inventory', 500, req.user?.user_id, { itemId, action: 'buy', amount, error: errorMsg });
            res.status(500).send({ message: 'Error buying item', error: errorMsg });
        }
    }
    async sellItem(req, res) {
        const { itemId } = req.params;
        const { amount, purchasePrice, dataItemIndex } = req.body;
        if (!itemId || isNaN(amount)) {
            await this.createLog(req, 'inventory', 400, req.user?.user_id, { reason: 'invalid_input', itemId, amount });
            return res.status(400).send({ message: 'Invalid input' });
        }
        try {
            const item = await this.itemService.getItem(itemId);
            if (!item || item.deleted) {
                await this.createLog(req, 'inventory', 404, req.user?.user_id, { itemId, action: 'sell' });
                return res.status(404).send({ message: 'Item not found' });
            }
            const user = req.user;
            if (!user) {
                await this.createLog(req, 'inventory', 404, req.user?.user_id, { itemId, action: 'sell', reason: 'user_not_found' });
                return res.status(404).send({ message: 'User not found' });
            }
            const repo = this.inventoryService.getInventoryRepository();
            const correctedUserId = await this.inventoryService.getCorrectedUserId(user.user_id);
            if (purchasePrice !== undefined) {
                const itemsWithPrice = (await repo.getInventory({ userId: correctedUserId, itemId, sellable: true, purchasePrice })).filter(invItem => invItem.purchasePrice === purchasePrice);
                const totalAvailable = itemsWithPrice.reduce((sum, item) => sum + item.amount, 0);
                if (totalAvailable < amount) {
                    await this.createLog(req, 'inventory', 400, req.user?.user_id, { itemId, action: 'sell', reason: 'insufficient_items_with_price', requested: amount, available: totalAvailable, purchasePrice });
                    return res.status(400).send({ message: `Insufficient items with purchase price ${purchasePrice}. You have ${totalAvailable} but requested to sell ${amount}.` });
                }
                await repo.removeSellableItemWithPrice(correctedUserId, itemId, amount, purchasePrice, dataItemIndex);
                const sellValue = purchasePrice * amount * 0.75;
                const isOwner = user.user_id === item.owner;
                if (!isOwner)
                    await this.userService.updateUserBalance(user.user_id, user.balance + sellValue);
                await this.createLog(req, 'inventory', 200, req.user?.user_id, { itemId, action: 'sell', amount, purchasePrice, total_value: sellValue, is_owner: isOwner, item_name: item.name });
                res.status(200).send({ message: 'Item sold', totalValue: Math.round(sellValue), itemsSold: amount });
                return;
            }
            const items = await repo.getInventory({ userId: correctedUserId, itemId, sellable: true });
            const totalAvailable = items.filter(i => !i.metadata).reduce((sum, i) => sum + i.amount, 0);
            if (totalAvailable < amount) {
                await this.createLog(req, 'inventory', 400, req.user?.user_id, { itemId, action: 'sell', reason: 'insufficient_items', requested: amount, available: totalAvailable });
                return res.status(400).send({ message: `Insufficient items to sell. You have ${totalAvailable} but requested to sell ${amount}.` });
            }
            await repo.removeSellableItem(correctedUserId, itemId, amount);
            const sellValue = item.price * amount * 0.75;
            const isOwner = user.user_id === item.owner;
            if (!isOwner)
                await this.userService.updateUserBalance(user.user_id, user.balance + sellValue);
            await this.createLog(req, 'inventory', 200, req.user?.user_id, { itemId, action: 'sell', amount, total_value: sellValue, is_owner: isOwner, item_name: item.name });
            res.status(200).send({ message: 'Item sold', totalValue: Math.round(sellValue), itemsSold: amount });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await this.createLog(req, 'inventory', 500, req.user?.user_id, { itemId, action: 'sell', amount, purchasePrice, error: errorMsg });
            res.status(500).send({ message: 'Error selling item', error: errorMsg });
        }
    }
    async consumeItem(req, res) {
        const { itemId } = req.params;
        const { amount, uniqueId, userId } = req.body;
        if (!itemId || !userId) {
            await this.createLog(req, 'inventory', 400, req.user?.user_id, { reason: 'missing_required_fields', itemId, userId });
            return res.status(400).send({ message: 'Invalid input: itemId and userId are required' });
        }
        if ((amount && uniqueId) || (!amount && !uniqueId)) {
            await this.createLog(req, 'inventory', 400, req.user?.user_id, { reason: 'invalid_parameters', itemId, userId, has_amount: !!amount, has_uniqueId: !!uniqueId });
            return res.status(400).send({ message: "Invalid input: provide either 'amount' for items without metadata OR 'uniqueId' for items with metadata" });
        }
        if (amount && isNaN(amount)) {
            await this.createLog(req, 'inventory', 400, req.user?.user_id, { reason: 'invalid_amount', itemId, userId, amount });
            return res.status(400).send({ message: 'Invalid input: amount must be a number' });
        }
        try {
            const targetUser = await this.userService.getUser(userId);
            if (!targetUser) {
                await this.createLog(req, 'inventory', 404, req.user?.user_id, { itemId, action: 'consume', userId, reason: 'target_user_not_found' });
                return res.status(404).send({ message: 'Target user not found' });
            }
            const item = await this.itemService.getItem(itemId);
            if (!item || item.deleted) {
                await this.createLog(req, 'inventory', 404, req.user?.user_id, { itemId, action: 'consume', userId });
                return res.status(404).send({ message: 'Item not found' });
            }
            const repo = this.inventoryService.getInventoryRepository();
            const correctedUserId = await this.inventoryService.getCorrectedUserId(targetUser.user_id);
            if (uniqueId) {
                await repo.removeItemByUniqueId(correctedUserId, itemId, uniqueId);
                await this.createLog(req, 'inventory', 200, req.user?.user_id, { itemId, action: 'consume', target_user_id: userId, target_username: targetUser.username, uniqueId, item_name: item.name });
                res.status(200).send({ message: 'Item with metadata consumed' });
            }
            else {
                const hasEnoughItems = await repo.hasItemWithoutMetadataSellable(correctedUserId, itemId, amount);
                if (!hasEnoughItems) {
                    await this.createLog(req, 'inventory', 400, req.user?.user_id, { itemId, action: 'consume', userId, amount, reason: 'insufficient_items' });
                    return res.status(400).send({ message: "User doesn't have enough items without metadata" });
                }
                await repo.removeItem(correctedUserId, itemId, amount);
                await this.createLog(req, 'inventory', 200, req.user?.user_id, { itemId, action: 'consume', amount, target_user_id: userId, target_username: targetUser.username, item_name: item.name });
                res.status(200).send({ message: 'Items without metadata consumed' });
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await this.createLog(req, 'inventory', 500, req.user?.user_id, { itemId, action: 'consume', amount, uniqueId, userId, error: errorMsg });
            res.status(500).send({ message: 'Error consuming item', error: errorMsg });
        }
    }
    async dropItem(req, res) {
        const { itemId } = req.params;
        const { amount, uniqueId, dataItemIndex } = req.body;
        if (!itemId) {
            await this.createLog(req, 'inventory', 400, req.user?.user_id, { reason: 'missing_itemId' });
            return res.status(400).send({ message: 'Invalid input: itemId is required' });
        }
        if ((amount && uniqueId) || (!amount && !uniqueId)) {
            await this.createLog(req, 'inventory', 400, req.user?.user_id, { reason: 'invalid_parameters', itemId, has_amount: !!amount, has_uniqueId: !!uniqueId });
            return res.status(400).send({ message: "Invalid input: provide either 'amount' for items without metadata OR 'uniqueId' for items with metadata" });
        }
        if (amount && isNaN(amount)) {
            await this.createLog(req, 'inventory', 400, req.user?.user_id, { reason: 'invalid_amount', itemId, amount });
            return res.status(400).send({ message: 'Invalid input: amount must be a number' });
        }
        try {
            const user = req.user;
            if (!user) {
                await this.createLog(req, 'inventory', 404, req.user?.user_id, { itemId, action: 'drop', reason: 'user_not_found' });
                return res.status(404).send({ message: 'User not found' });
            }
            const repo = this.inventoryService.getInventoryRepository();
            const correctedUserId = await this.inventoryService.getCorrectedUserId(user.user_id);
            if (uniqueId) {
                await repo.removeItemByUniqueId(correctedUserId, itemId, uniqueId);
                await this.createLog(req, 'inventory', 200, req.user?.user_id, { itemId, action: 'drop', uniqueId });
                res.status(200).send({ message: 'Item with metadata dropped' });
            }
            else {
                const hasEnoughItems = await repo.hasItemWithoutMetadata(correctedUserId, itemId, amount);
                if (!hasEnoughItems) {
                    await this.createLog(req, 'inventory', 400, req.user?.user_id, { itemId, action: 'drop', amount, reason: 'insufficient_items' });
                    return res.status(400).send({ message: "You don't have enough items without metadata to drop" });
                }
                await repo.removeItem(correctedUserId, itemId, amount, dataItemIndex);
                await this.createLog(req, 'inventory', 200, req.user?.user_id, { itemId, action: 'drop', amount });
                res.status(200).send({ message: 'Items without metadata dropped' });
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await this.createLog(req, 'inventory', 500, req.user?.user_id, { itemId, action: 'drop', amount, uniqueId, error: errorMsg });
            res.status(500).send({ message: 'Error dropping item', error: errorMsg });
        }
    }
    async transferOwnership(req, res) {
        const { itemId } = req.params;
        const { newOwnerId } = req.body;
        if (!itemId || !newOwnerId) {
            await this.createLog(req, 'items', 400, req.user?.user_id, { reason: 'invalid_input', itemId, newOwnerId });
            return res.status(400).send({ message: 'Invalid input' });
        }
        try {
            const item = await this.itemService.getItem(itemId);
            if (!item || item.deleted) {
                await this.createLog(req, 'items', 404, req.user?.user_id, { itemId, action: 'transfer_ownership' });
                return res.status(404).send({ message: 'Item not found' });
            }
            const newOwner = await this.userService.getUser(newOwnerId);
            if (!newOwner) {
                await this.createLog(req, 'items', 404, req.user?.user_id, { itemId, action: 'transfer_ownership', newOwnerId, reason: 'new_owner_not_found' });
                return res.status(404).send({ message: 'New owner not found' });
            }
            await this.itemService.transferOwnership(itemId, newOwnerId);
            await this.createLog(req, 'items', 200, req.user?.user_id, { itemId, action: 'transfer_ownership', old_owner: item.owner, new_owner: newOwnerId, new_owner_username: newOwner.username, item_name: item.name });
            res.status(200).send({ message: 'Ownership transferred' });
        }
        catch (error) {
            await this.createLog(req, 'items', 500, req.user?.user_id, { itemId, action: 'transfer_ownership', newOwnerId, error: error instanceof Error ? error.message : String(error) });
            handleError(res, error, 'Error transferring ownership');
        }
    }
};
exports.Items = Items;
__decorate([
    (0, describe_1.describe)({
        endpoint: '/items',
        method: 'GET',
        description: 'Get all non-deleted items visible in store',
        responseType: [
            {
                itemId: 'string',
                name: 'string',
                description: 'string',
                owner: 'string',
                price: 'number',
                iconHash: 'string',
            },
        ],
        example: 'GET /api/items',
    }),
    (0, inversify_express_utils_1.httpGet)('/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "getAllItems", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/items/@mine',
        method: 'GET',
        description: 'Get all items owned by the authenticated user.',
        responseType: [
            {
                itemId: 'string',
                name: 'string',
                description: 'string',
                owner: 'string',
                price: 'number',
                iconHash: 'string',
                showInStore: 'boolean',
            },
        ],
        example: 'GET /api/items/@mine',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpGet)('/@mine', LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "getMyItems", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/items/search',
        method: 'GET',
        description: 'Search for items by name (only those visible in store)',
        query: { q: 'The search query' },
        responseType: [
            {
                itemId: 'string',
                name: 'string',
                description: 'string',
                owner: 'string',
                price: 'number',
                iconHash: 'string',
                showInStore: 'boolean',
            },
        ],
        example: 'GET /api/items/search?q=Apple',
    }),
    (0, inversify_express_utils_1.httpGet)('/search'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "searchItems", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/items/:itemId',
        method: 'GET',
        description: 'Get a single item by itemId',
        params: { itemId: 'The id of the item' },
        responseType: {
            itemId: 'string',
            name: 'string',
            description: 'string',
            owner: 'string',
            price: 'number',
            showInStore: 'boolean',
            iconHash: 'string',
        },
        example: 'GET /api/items/123',
    }),
    (0, inversify_express_utils_1.httpGet)('/:itemId'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "getItem", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/items/create',
        method: 'POST',
        description: 'Create a new item.',
        body: {
            name: 'Name of the item',
            description: 'Description of the item',
            price: 'Price of the item',
            iconHash: 'Hash of the icon (optional)',
            showInStore: 'Show in store (optional, boolean)',
        },
        responseType: { message: 'string' },
        example: 'POST /api/items/create {"name": "Apple", "description": "A fruit", "price": 100, "iconHash": "abc123", "showInStore": true}',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)('/create', LoggedCheck_1.LoggedCheck.middleware, createItemRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "createItem", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/items/update/:itemId',
        method: 'PUT',
        description: 'Update an existing item.',
        params: { itemId: 'The id of the item' },
        body: {
            name: 'Name of the item',
            description: 'Description of the item',
            price: 'Price of the item',
            iconHash: 'Hash of the icon (optional)',
            showInStore: 'Show in store (optional, boolean)',
        },
        responseType: { message: 'string' },
        example: 'PUT /api/items/update/123 {"name": "Apple", "description": "A fruit", "price": 100, "iconHash": "abc123", "showInStore": true}',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPut)('/update/:itemId', OwnerCheck_1.OwnerCheck.middleware, updateItemRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "updateItem", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/items/delete/:itemId',
        method: 'DELETE',
        description: 'Delete an item.',
        params: { itemId: 'The id of the item' },
        responseType: { message: 'string' },
        example: 'DELETE /api/items/delete/123',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpDelete)('/delete/:itemId', OwnerCheck_1.OwnerCheck.middleware, deleteItemRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "deleteItem", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)('/buy/:itemId', LoggedCheck_1.LoggedCheck.middleware, buyItemRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "buyItem", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)('/sell/:itemId', LoggedCheck_1.LoggedCheck.middleware, sellItemRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "sellItem", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)('/consume/:itemId', OwnerCheck_1.OwnerCheck.middleware, consumeItemRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "consumeItem", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)('/drop/:itemId', LoggedCheck_1.LoggedCheck.middleware, dropItemRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "dropItem", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)('/transfer-ownership/:itemId', OwnerCheck_1.OwnerCheck.middleware, transferOwnershipRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Items.prototype, "transferOwnership", null);
exports.Items = Items = __decorate([
    (0, inversify_express_utils_1.controller)('/items'),
    __param(0, (0, inversify_1.inject)('ItemService')),
    __param(1, (0, inversify_1.inject)('InventoryService')),
    __param(2, (0, inversify_1.inject)('UserService')),
    __param(3, (0, inversify_1.inject)('LogService')),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], Items);
