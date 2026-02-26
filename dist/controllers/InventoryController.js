"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Inventories = void 0;
const inversify_1 = require("inversify");
const yup_1 = require("yup");
const describe_1 = require("../decorators/describe");
const hono_inversify_1 = require("../hono-inversify");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const InventoryValidator_1 = require("../validators/InventoryValidator");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
async function validateOr400(schema, data, res) {
    try {
        await schema.validate(data);
        return true;
    }
    catch (error) {
        if (error instanceof yup_1.ValidationError) {
            res.status(400).send({
                message: 'Validation failed',
                errors: error.errors,
            });
            return false;
        }
        throw error;
    }
}
let Inventories = class Inventories {
    constructor(inventoryService, logService) {
        this.inventoryService = inventoryService;
        this.logService = logService;
    }
    async createLog(req, action, tableName, statusCode, userId) {
        try {
            await this.logService.createLog({
                ip_address: req.headers['x-real-ip'] || req.socket.remoteAddress,
                table_name: tableName,
                controller: `InventoryController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: req.body,
                user_id: userId,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    async getMyInventory(req, res) {
        const userId = req.user.user_id;
        try {
            const inventory = await this.inventoryService.getInventory(userId);
            await this.createLog(req, 'getMyInventory', 'inventory', 200, userId);
            res.send(inventory);
        }
        catch (error) {
            await this.createLog(req, 'getMyInventory', 'inventory', 500, userId);
            handleError(res, error, 'Error fetching inventory');
        }
    }
    async getInventory(req, res) {
        if (!(await validateOr400(InventoryValidator_1.userIdParamSchema, { userId: req.params.userId }, res))) {
            await this.createLog(req, 'getInventory', 'inventory', 400, req.params.userId);
            return;
        }
        const userId = req.params.userId;
        try {
            const inventory = await this.inventoryService.getInventory(userId);
            await this.createLog(req, 'getInventory', 'inventory', 200, userId);
            res.send(inventory);
        }
        catch (error) {
            await this.createLog(req, 'getInventory', 'inventory', 500, userId);
            handleError(res, error, 'Error fetching inventory');
        }
    }
    async getItemAmount(req, res) {
        const { userId, itemId } = req.params;
        try {
            const correctedUserId = await this.inventoryService.getCorrectedUserId(userId);
            const repo = this.inventoryService.getInventoryRepository();
            const amount = await repo.getItemAmount(correctedUserId, itemId);
            res.send({ userId, itemId, amount });
        }
        catch (error) {
            handleError(res, error, 'Error fetching item amount');
        }
    }
    async getAllInventories(req, res) {
        await this.createLog(req, 'getAllInventories', 'inventory', 400);
        res.send({ message: 'Please specify /api/inventory/<userId>' });
    }
};
exports.Inventories = Inventories;
__decorate([
    (0, describe_1.describe)({
        endpoint: '/inventory/@me',
        method: 'GET',
        description: 'Get the inventory of the authenticated user with all item instances and item details',
        responseType: {
            user_id: 'string',
            inventory: [
                {
                    user_id: 'string',
                    item_id: 'string',
                    amount: 'number',
                    metadata: 'object (optional, includes _unique_id for unique items)',
                    sellable: 'boolean',
                    purchasePrice: 'number (optional, price at which the item was purchased)',
                    itemId: 'string',
                    name: 'string',
                    description: 'string',
                    iconHash: 'string',
                    price: 'number',
                    owner: 'string',
                    showInStore: 'boolean',
                },
            ],
        },
        example: 'GET /api/inventory/@me',
        requiresAuth: true,
    }),
    (0, hono_inversify_1.httpGet)('/@me', LoggedCheck_1.LoggedCheck.middleware)
], Inventories.prototype, "getMyInventory", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/inventory/:userId',
        method: 'GET',
        description: 'Get the inventory of a user with all item instances and item details',
        params: { userId: 'The id of the user' },
        responseType: {
            user_id: 'string',
            inventory: [
                {
                    user_id: 'string',
                    item_id: 'string',
                    amount: 'number',
                    metadata: 'object (optional, includes _unique_id for unique items)',
                    sellable: 'boolean',
                    purchasePrice: 'number (optional, price at which the item was purchased)',
                    itemId: 'string',
                    name: 'string',
                    description: 'string',
                    iconHash: 'string',
                    price: 'number',
                    owner: 'string',
                    showInStore: 'boolean',
                },
            ],
        },
        example: 'GET /api/inventory/123',
    }),
    (0, hono_inversify_1.httpGet)('/:userId')
], Inventories.prototype, "getInventory", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/inventory/:userId/item/:itemId/amount',
        method: 'GET',
        description: 'Get the amount of a specific item for a user',
        params: {
            userId: 'The id of the user',
            itemId: 'The id of the item',
        },
        responseType: {
            userId: 'string',
            itemId: 'string',
            amount: 'number',
        },
        example: 'GET /api/inventory/123/item/456/amount',
    }),
    (0, hono_inversify_1.httpGet)('/:userId/item/:itemId/amount')
], Inventories.prototype, "getItemAmount", null);
__decorate([
    (0, hono_inversify_1.httpGet)('/')
], Inventories.prototype, "getAllInventories", null);
exports.Inventories = Inventories = __decorate([
    (0, hono_inversify_1.controller)('/inventory'),
    __param(0, (0, inversify_1.inject)('InventoryService')),
    __param(1, (0, inversify_1.inject)('LogService'))
], Inventories);
