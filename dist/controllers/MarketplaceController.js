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
exports.MarketplaceController = void 0;
const inversify_express_utils_1 = require("inversify-express-utils");
const inversify_1 = require("inversify");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const describe_1 = require("../decorators/describe");
let MarketplaceController = class MarketplaceController {
    constructor(marketplaceService) {
        this.marketplaceService = marketplaceService;
    }
    async createSale(req, res) {
        const { itemId, uniqueId, price } = req.body;
        if (!itemId || !price || price <= 0) {
            return res.status(400).json({ message: "Invalid input" });
        }
        try {
            const saleId = await this.marketplaceService.createSale(req.user.user_id, itemId, uniqueId, price);
            res.status(200).json({ saleId, message: "Item put up for sale" });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            res.status(400).json({ message: errorMsg });
        }
    }
    async createBuyOrder(req, res) {
        const { itemId, maxPrice } = req.body;
        if (!itemId || !maxPrice || maxPrice <= 0) {
            return res.status(400).json({ message: "Invalid input" });
        }
        try {
            const orderId = await this.marketplaceService.createBuyOrder(req.user.user_id, itemId, maxPrice);
            res.status(200).json({ orderId, message: "Buy order created" });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            res.status(400).json({ message: errorMsg });
        }
    }
    async cancelSale(req, res) {
        try {
            await this.marketplaceService.cancelSale(req.params.saleId, req.user.user_id);
            res.status(200).json({ message: "Sale cancelled" });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            res.status(400).json({ message: errorMsg });
        }
    }
    async cancelBuyOrder(req, res) {
        try {
            await this.marketplaceService.cancelBuyOrder(req.params.orderId, req.user.user_id);
            res.status(200).json({ message: "Buy order cancelled" });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            res.status(400).json({ message: errorMsg });
        }
    }
    async getMySales(req, res) {
        try {
            const sales = await this.marketplaceService.getSalesByUser(req.user.user_id);
            res.status(200).json(sales);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            res.status(500).json({ message: errorMsg });
        }
    }
    async getMyBuyOrders(req, res) {
        try {
            const orders = await this.marketplaceService.getBuyOrdersByUser(req.user.user_id);
            res.status(200).json(orders);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            res.status(500).json({ message: errorMsg });
        }
    }
    async getItemMarketplace(req, res) {
        try {
            const { itemId } = req.params;
            const [sales, buyOrders] = await Promise.all([
                this.marketplaceService.getActiveSalesForItem(itemId),
                this.marketplaceService.getActiveBuyOrdersForItem(itemId)
            ]);
            res.status(200).json({ sales, buyOrders });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            res.status(500).json({ message: errorMsg });
        }
    }
    async getHistory(req, res) {
        try {
            const history = await this.marketplaceService.getMarketplaceHistory(req.user.user_id);
            res.status(200).json(history);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            res.status(500).json({ message: errorMsg });
        }
    }
    async searchItems(req, res) {
        try {
            const { q } = req.query;
            if (!q || typeof q !== 'string') {
                return res.status(400).json({ message: "Search query required" });
            }
            // Rechercher dans tous les items du jeu, pas dans l'inventaire de l'utilisateur
            const items = await this.marketplaceService.searchAllItems(q);
            res.status(200).json(items);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            res.status(500).json({ message: errorMsg });
        }
    }
    async getMySellableItems(req, res) {
        try {
            // Cette méthode retourne les items vendables de l'inventaire de l'utilisateur
            const items = await this.marketplaceService.getUserSellableItems(req.user.user_id);
            res.status(200).json(items);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            res.status(500).json({ message: errorMsg });
        }
    }
};
__decorate([
    (0, describe_1.describe)({
        endpoint: "/marketplace/sell",
        method: "POST",
        description: "Put an item for sale in the marketplace",
        body: {
            itemId: "The ID of the item to sell",
            uniqueId: "The unique ID for items with metadata (optional)",
            price: "The selling price"
        },
        responseType: { saleId: "string", message: "string" },
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)("/sell", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "createSale", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/marketplace/buy-order",
        method: "POST",
        description: "Create a buy order for an item",
        body: {
            itemId: "The ID of the item to buy",
            maxPrice: "The maximum price willing to pay"
        },
        responseType: { orderId: "string", message: "string" },
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)("/buy-order", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "createBuyOrder", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/marketplace/sales/:saleId",
        method: "DELETE",
        description: "Cancel a sale",
        params: { saleId: "The ID of the sale to cancel" },
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpDelete)("/sales/:saleId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "cancelSale", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/marketplace/buy-orders/:orderId",
        method: "DELETE",
        description: "Cancel a buy order",
        params: { orderId: "The ID of the buy order to cancel" },
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpDelete)("/buy-orders/:orderId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "cancelBuyOrder", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/marketplace/my-sales",
        method: "GET",
        description: "Get user's sales",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpGet)("/my-sales", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "getMySales", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/marketplace/my-buy-orders",
        method: "GET",
        description: "Get user's buy orders",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpGet)("/my-buy-orders", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "getMyBuyOrders", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/marketplace/item/:itemId",
        method: "GET",
        description: "Get marketplace data for a specific item",
        params: { itemId: "The ID of the item" },
    }),
    (0, inversify_express_utils_1.httpGet)("/item/:itemId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "getItemMarketplace", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/marketplace/history",
        method: "GET",
        description: "Get user's marketplace transaction history",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpGet)("/history", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "getHistory", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/marketplace/search",
        method: "GET",
        description: "Search all available items in the game for marketplace",
        query: { q: "Search query" },
    }),
    (0, inversify_express_utils_1.httpGet)("/search"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "searchItems", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/marketplace/my-sellable-items",
        method: "GET",
        description: "Get user's sellable items from inventory",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpGet)("/my-sellable-items", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketplaceController.prototype, "getMySellableItems", null);
MarketplaceController = __decorate([
    (0, inversify_express_utils_1.controller)("/marketplace"),
    __param(0, (0, inversify_1.inject)("MarketplaceService")),
    __metadata("design:paramtypes", [Object])
], MarketplaceController);
exports.MarketplaceController = MarketplaceController;
