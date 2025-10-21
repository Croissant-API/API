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
exports.BuyOrderController = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
let BuyOrderController = class BuyOrderController {
    constructor(buyOrderService, itemService, logService) {
        this.buyOrderService = buyOrderService;
        this.itemService = itemService;
        this.logService = logService;
    }
    async logAction(req, action, statusCode, metadata) {
        try {
            const requestBody = { ...req.body };
            if (metadata)
                requestBody.metadata = metadata;
            await this.logService.createLog({
                ip_address: req.headers['x-real-ip'] || req.socket.remoteAddress,
                table_name: 'buy_order',
                controller: `BuyOrderController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: req.user?.user_id,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    async createBuyOrder(req, res) {
        const buyerId = req.user.user_id;
        const { itemId, price } = req.body;
        if (!itemId || typeof price !== 'number' || price < 1) {
            await this.logAction(req, 'createBuyOrder', 400);
            return res.status(400).send({ message: 'itemId and price are required' });
        }
        const itemExists = await this.itemService.getItem(itemId);
        if (!itemExists) {
            await this.logAction(req, 'createBuyOrder', 404);
            return res.status(404).send({ message: 'Item not found' });
        }
        try {
            const order = await this.buyOrderService.createBuyOrder(buyerId, itemId, price);
            await this.logAction(req, 'createBuyOrder', 201);
            res.status(201).send(order);
        }
        catch (error) {
            await this.logAction(req, 'createBuyOrder', 500, { error });
            handleError(res, error, 'Error while creating buy order');
        }
    }
    async cancelBuyOrder(req, res) {
        const buyerId = req.user.user_id;
        const orderId = req.params.id;
        try {
            await this.buyOrderService.cancelBuyOrder(orderId, buyerId);
            await this.logAction(req, 'cancelBuyOrder', 200);
            res.status(200).send({ message: 'Buy order cancelled' });
        }
        catch (error) {
            await this.logAction(req, 'cancelBuyOrder', 500, { error });
            handleError(res, error, 'Error while cancelling buy order');
        }
    }
    async getBuyOrdersByUser(req, res) {
        const userId = req.params.userId;
        if (userId !== req.user.user_id) {
            await this.logAction(req, 'getBuyOrdersByUser', 403);
            return res.status(403).send({ message: 'Forbidden' });
        }
        try {
            const orders = await this.buyOrderService.getBuyOrders({ userId });
            await this.logAction(req, 'getBuyOrdersByUser', 200);
            res.send(orders);
        }
        catch (error) {
            await this.logAction(req, 'getBuyOrdersByUser', 500, { error });
            handleError(res, error, 'Error while fetching buy orders');
        }
    }
    async getActiveBuyOrdersForItem(req, res) {
        const itemId = req.params.itemId;
        try {
            const orders = await this.buyOrderService.getBuyOrders({ itemId, status: 'active' }, 'price DESC, created_at ASC');
            await this.logAction(req, 'getActiveBuyOrdersForItem', 200);
            res.send(orders);
        }
        catch (error) {
            await this.logAction(req, 'getActiveBuyOrdersForItem', 500, { error });
            handleError(res, error, 'Error while fetching buy orders');
        }
    }
};
exports.BuyOrderController = BuyOrderController;
__decorate([
    (0, inversify_express_utils_1.httpPost)('/', LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "createBuyOrder", null);
__decorate([
    (0, inversify_express_utils_1.httpPut)('/:id/cancel', LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "cancelBuyOrder", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)('/user/:userId', LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "getBuyOrdersByUser", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)('/item/:itemId'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "getActiveBuyOrdersForItem", null);
exports.BuyOrderController = BuyOrderController = __decorate([
    (0, inversify_express_utils_1.controller)('/buy-orders'),
    __param(0, (0, inversify_1.inject)('BuyOrderService')),
    __param(1, (0, inversify_1.inject)('ItemService')),
    __param(2, (0, inversify_1.inject)('LogService')),
    __metadata("design:paramtypes", [Object, Object, Object])
], BuyOrderController);
