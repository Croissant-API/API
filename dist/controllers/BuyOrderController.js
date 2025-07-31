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
let BuyOrderController = class BuyOrderController {
    constructor(buyOrderService, itemService) {
        this.buyOrderService = buyOrderService;
        this.itemService = itemService;
    }
    async createBuyOrder(req, res) {
        const buyerId = req.user.user_id;
        const { itemId, price } = req.body;
        if (!itemId || typeof price !== "number" || price < 1) {
            return res.status(400).send({ message: "itemId and price are required" });
        }
        // S'assurer que l'item existe
        const itemExists = await this.itemService.getItem(itemId);
        if (!itemExists) {
            return res.status(404).send({ message: "Item not found" });
        }
        try {
            const order = await this.buyOrderService.createBuyOrder(buyerId, itemId, price);
            res.status(201).send(order);
        }
        catch (error) {
            res.status(500).send({ message: "Error while creating buy order", error: String(error) });
        }
    }
    async cancelBuyOrder(req, res) {
        const buyerId = req.user.user_id;
        const orderId = req.params.id;
        try {
            await this.buyOrderService.cancelBuyOrder(orderId, buyerId);
            res.status(200).send({ message: "Buy order cancelled" });
        }
        catch (error) {
            res.status(500).send({ message: "Error while cancelling buy order", error: String(error) });
        }
    }
    async getBuyOrdersByUser(req, res) {
        const userId = req.params.userId;
        if (userId !== req.user.user_id) {
            return res.status(403).send({ message: "Forbidden" });
        }
        try {
            const orders = await this.buyOrderService.getBuyOrdersByUser(userId);
            res.send(orders);
        }
        catch (error) {
            res.status(500).send({ message: "Error while fetching buy orders", error: String(error) });
        }
    }
    async getActiveBuyOrdersForItem(req, res) {
        const itemId = req.params.itemId;
        try {
            const orders = await this.buyOrderService.getActiveBuyOrdersForItem(itemId);
            res.send(orders);
        }
        catch (error) {
            res.status(500).send({ message: "Error while fetching buy orders", error: String(error) });
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpPost)("/", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "createBuyOrder", null);
__decorate([
    (0, inversify_express_utils_1.httpPut)("/:id/cancel", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "cancelBuyOrder", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/user/:userId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "getBuyOrdersByUser", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/item/:itemId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BuyOrderController.prototype, "getActiveBuyOrdersForItem", null);
BuyOrderController = __decorate([
    (0, inversify_express_utils_1.controller)("/buy-orders"),
    __param(0, (0, inversify_1.inject)("BuyOrderService")),
    __param(1, (0, inversify_1.inject)("ItemService")),
    __metadata("design:paramtypes", [Object, Object])
], BuyOrderController);
exports.BuyOrderController = BuyOrderController;
