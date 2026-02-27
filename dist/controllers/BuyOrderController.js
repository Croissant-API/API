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
import { controller, httpGet, httpPost, httpPut } from '../hono-inversify';
import { LoggedCheck } from '../middlewares/LoggedCheck';
let BuyOrderController = class BuyOrderController {
    constructor(buyOrderService, itemService, logService) {
        this.buyOrderService = buyOrderService;
        this.itemService = itemService;
        this.logService = logService;
    }
    async logAction(c, action, statusCode, metadata) {
        try {
            const requestBody = (await c.req.json().catch(() => ({}))) || {};
            if (metadata)
                Object.assign(requestBody, { metadata });
            await this.logService.createLog({
                ip_address: c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
                table_name: 'buy_order',
                controller: `BuyOrderController.${action}`,
                original_path: c.req.path,
                http_method: c.req.method,
                request_body: requestBody,
                user_id: this.getUserFromContext(c)?.user_id,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    sendError(c, status, message, error) {
        const msg = error instanceof Error ? error.message : String(error);
        return c.json({ message, error: msg }, status);
    }
    getUserFromContext(c) {
        return c.get('user');
    }
    async createBuyOrder(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const { itemId, price } = await c.req.json();
        if (!itemId || typeof price !== 'number' || price < 1) {
            await this.logAction(c, 'createBuyOrder', 400);
            return this.sendError(c, 400, 'itemId and price are required');
        }
        const itemExists = await this.itemService.getItem(itemId);
        if (!itemExists) {
            await this.logAction(c, 'createBuyOrder', 404);
            return this.sendError(c, 404, 'Item not found');
        }
        try {
            const order = await this.buyOrderService.createBuyOrder(user.user_id, itemId, price);
            await this.logAction(c, 'createBuyOrder', 201);
            return c.json(order, 201);
        }
        catch (error) {
            await this.logAction(c, 'createBuyOrder', 500, { error });
            return this.sendError(c, 500, 'Error while creating buy order', error);
        }
    }
    async cancelBuyOrder(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const orderId = c.req.param('id');
        try {
            await this.buyOrderService.cancelBuyOrder(orderId, user.user_id);
            await this.logAction(c, 'cancelBuyOrder', 200);
            return c.json({ message: 'Buy order cancelled' }, 200);
        }
        catch (error) {
            await this.logAction(c, 'cancelBuyOrder', 500, { error });
            return this.sendError(c, 500, 'Error while cancelling buy order', error);
        }
    }
    async getBuyOrdersByUser(c) {
        const user = this.getUserFromContext(c);
        const userId = c.req.param('userId');
        if (!user || userId !== user.user_id) {
            await this.logAction(c, 'getBuyOrdersByUser', 403);
            return this.sendError(c, 403, 'Forbidden');
        }
        try {
            const orders = await this.buyOrderService.getBuyOrders({ userId });
            await this.logAction(c, 'getBuyOrdersByUser', 200);
            return c.json(orders);
        }
        catch (error) {
            await this.logAction(c, 'getBuyOrdersByUser', 500, { error });
            return this.sendError(c, 500, 'Error while fetching buy orders', error);
        }
    }
    async getActiveBuyOrdersForItem(c) {
        const itemId = c.req.param('itemId');
        try {
            const orders = await this.buyOrderService.getBuyOrders({ itemId, status: 'active' }, 'price DESC, created_at ASC');
            await this.logAction(c, 'getActiveBuyOrdersForItem', 200);
            return c.json(orders);
        }
        catch (error) {
            await this.logAction(c, 'getActiveBuyOrdersForItem', 500, { error });
            return this.sendError(c, 500, 'Error while fetching buy orders', error);
        }
    }
};
__decorate([
    httpPost('/', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "createBuyOrder", null);
__decorate([
    httpPut('/:id/cancel', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "cancelBuyOrder", null);
__decorate([
    httpGet('/user/:userId', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "getBuyOrdersByUser", null);
__decorate([
    httpGet('/item/:itemId'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "getActiveBuyOrdersForItem", null);
BuyOrderController = __decorate([
    injectable(),
    controller('/buy-orders'),
    __param(0, inject('BuyOrderService')),
    __param(1, inject('ItemService')),
    __param(2, inject('LogService')),
    __metadata("design:paramtypes", [Object, Object, Object])
], BuyOrderController);
export { BuyOrderController };
