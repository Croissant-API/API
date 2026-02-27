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
import { inject, injectable } from 'inversify';
import { controller, httpGet } from '../hono-inversify';
import { LoggedCheck } from '../middlewares/LoggedCheck';
let Inventories = class Inventories {
    constructor(inventoryService, logService) {
        this.inventoryService = inventoryService;
        this.logService = logService;
    }
    async createLog(c, action, tableName, statusCode, userId, metadata) {
        try {
            const clientIP = c.req.header('cf-connecting-ip') ||
                c.req.header('x-forwarded-for') ||
                c.req.header('x-real-ip') ||
                'unknown';
            await this.logService.createLog({
                ip_address: clientIP,
                table_name: tableName,
                controller: `InventoryController.${action}`,
                original_path: c.req.path,
                http_method: c.req.method,
                request_body: JSON.stringify(metadata || {}),
                user_id: userId,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    sendError(c, status, message, error) {
        return c.json({ message, error: error ? (error instanceof Error ? error.message : String(error)) : undefined }, status);
    }
    getUserFromContext(c) {
        return c.get('user');
    }
    async getMyInventory(c) {
        const user = this.getUserFromContext(c);
        if (!user) {
            await this.createLog(c, 'getMyInventory', 'inventory', 401);
            return this.sendError(c, 401, 'Unauthorized');
        }
        try {
            const inventory = await this.inventoryService.getInventory(user.user_id);
            await this.createLog(c, 'getMyInventory', 'inventory', 200, user.user_id);
            return c.json(inventory);
        }
        catch (error) {
            await this.createLog(c, 'getMyInventory', 'inventory', 500, user.user_id);
            return this.sendError(c, 500, 'Error fetching inventory', error);
        }
    }
    async getInventory(c) {
        const userId = c.req.param('userId');
        // Optionally validate userId here if needed
        try {
            const inventory = await this.inventoryService.getInventory(userId);
            await this.createLog(c, 'getInventory', 'inventory', 200, userId);
            return c.json(inventory);
        }
        catch (error) {
            await this.createLog(c, 'getInventory', 'inventory', 500, userId);
            return this.sendError(c, 500, 'Error fetching inventory', error);
        }
    }
    async getItemAmount(c) {
        const userId = c.req.param('userId');
        const itemId = c.req.param('itemId');
        try {
            const correctedUserId = await this.inventoryService.getCorrectedUserId(userId);
            const repo = this.inventoryService.getInventoryRepository();
            const amount = await repo.getItemAmount(correctedUserId, itemId);
            return c.json({ userId, itemId, amount });
        }
        catch (error) {
            return this.sendError(c, 500, 'Error fetching item amount', error);
        }
    }
    async getAllInventories(c) {
        await this.createLog(c, 'getAllInventories', 'inventory', 400);
        return c.json({ message: 'Please specify /api/inventory/<userId>' });
    }
};
__decorate([
    httpGet('/@me', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Inventories.prototype, "getMyInventory", null);
__decorate([
    httpGet('/:userId'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Inventories.prototype, "getInventory", null);
__decorate([
    httpGet('/:userId/item/:itemId/amount'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Inventories.prototype, "getItemAmount", null);
__decorate([
    httpGet('/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Inventories.prototype, "getAllInventories", null);
Inventories = __decorate([
    injectable(),
    controller('/inventory'),
    __param(0, inject('InventoryService')),
    __param(1, inject('LogService')),
    __metadata("design:paramtypes", [Object, Object])
], Inventories);
export { Inventories };
