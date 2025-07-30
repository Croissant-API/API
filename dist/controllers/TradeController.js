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
exports.Trades = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const describe_1 = require("../decorators/describe");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
let Trades = class Trades {
    constructor(tradeService, logService) {
        this.tradeService = tradeService;
        this.logService = logService;
    }
    // Helper pour les logs
    async logAction(req, tableName, statusCode, metadata) {
        try {
            const requestBody = { ...req.body };
            // Ajouter les métadonnées si fournies
            if (metadata) {
                requestBody.metadata = metadata;
            }
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] || req.socket.remoteAddress,
                table_name: tableName,
                controller: 'TradeController',
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: req.user?.user_id,
                status_code: statusCode
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    // --- Démarrage ou récupération de trade ---
    async startOrGetPendingTrade(req, res) {
        const fromUserId = req.user.user_id;
        const toUserId = req.params.userId;
        if (fromUserId === toUserId) {
            await this.logAction(req, 'trades', 400, {
                reason: 'self_trade_attempt',
                target_user_id: toUserId
            });
            return res.status(400).send({ message: "Cannot trade with yourself" });
        }
        try {
            const trade = await this.tradeService.startOrGetPendingTrade(fromUserId, toUserId);
            await this.logAction(req, 'trades', 200, {
                trade_id: trade.id,
                target_user_id: toUserId,
                trade_status: trade.status,
                is_new_trade: trade.createdAt === trade.updatedAt
            });
            res.status(200).send(trade);
        }
        catch (error) {
            await this.logAction(req, 'trades', 500, {
                target_user_id: toUserId,
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error starting or getting trade");
        }
    }
    // --- Lecture ---
    async getTradeById(req, res) {
        const id = req.params.id;
        try {
            const trade = await this.tradeService.getFormattedTradeById(id);
            if (!trade) {
                await this.logAction(req, 'trades', 404, { trade_id: id });
                return res.status(404).send({ message: "Trade not found" });
            }
            if (trade.fromUserId !== req.user.user_id && trade.toUserId !== req.user.user_id) {
                await this.logAction(req, 'trades', 403, {
                    trade_id: id,
                    reason: 'not_participant',
                    from_user_id: trade.fromUserId,
                    to_user_id: trade.toUserId
                });
                return res.status(403).send({ message: "Forbidden" });
            }
            await this.logAction(req, 'trades', 200, {
                trade_id: id,
                trade_status: trade.status,
                from_user_id: trade.fromUserId,
                to_user_id: trade.toUserId,
                items_count: {
                    from_user: trade.fromUserItems.length,
                    to_user: trade.toUserItems.length
                }
            });
            res.send(trade);
        }
        catch (error) {
            await this.logAction(req, 'trades', 500, {
                trade_id: id,
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error fetching trade");
        }
    }
    async getTradesByUser(req, res) {
        const userId = req.params.userId;
        if (userId !== req.user.user_id) {
            await this.logAction(req, 'trades', 403, {
                reason: 'unauthorized_user_access',
                requested_user_id: userId
            });
            return res.status(403).send({ message: "Forbidden" });
        }
        try {
            const trades = await this.tradeService.getFormattedTradesByUser(userId);
            await this.logAction(req, 'trades', 200, {
                user_id: userId,
                trades_count: trades.length,
                trades_by_status: trades.reduce((acc, trade) => {
                    acc[trade.status] = (acc[trade.status] || 0) + 1;
                    return acc;
                }, {})
            });
            res.send(trades);
        }
        catch (error) {
            await this.logAction(req, 'trades', 500, {
                user_id: userId,
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error fetching trades");
        }
    }
    // --- Actions sur une trade ---
    async addItemToTrade(req, res) {
        const tradeId = req.params.id;
        const { tradeItem } = req.body;
        if (!tradeItem.itemId || !tradeItem.amount || tradeItem.amount <= 0) {
            await this.logAction(req, 'trade_items', 400, {
                trade_id: tradeId,
                action: 'add_item',
                reason: 'invalid_trade_item_format',
                trade_item: tradeItem
            });
            return res.status(400).send({ message: "Invalid tradeItem format" });
        }
        try {
            await this.tradeService.addItemToTrade(tradeId, req.user.user_id, tradeItem);
            await this.logAction(req, 'trade_items', 200, {
                trade_id: tradeId,
                action: 'add_item',
                item_id: tradeItem.itemId,
                amount: tradeItem.amount,
                has_metadata: !!tradeItem.metadata,
                has_unique_id: !!tradeItem.metadata?._unique_id
            });
            res.status(200).send({ message: "Item added to trade" });
        }
        catch (error) {
            await this.logAction(req, 'trade_items', 500, {
                trade_id: tradeId,
                action: 'add_item',
                item_id: tradeItem.itemId,
                amount: tradeItem.amount,
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error adding item to trade");
        }
    }
    async removeItemFromTrade(req, res) {
        const tradeId = req.params.id;
        const { tradeItem } = req.body;
        if (!tradeItem.itemId) {
            await this.logAction(req, 'trade_items', 400, {
                trade_id: tradeId,
                action: 'remove_item',
                reason: 'missing_item_id'
            });
            return res.status(400).send({ message: "Invalid tradeItem format" });
        }
        // Pour les items avec _unique_id, l'amount peut être omis
        if (!tradeItem.metadata?._unique_id && (!tradeItem.amount || tradeItem.amount <= 0)) {
            await this.logAction(req, 'trade_items', 400, {
                trade_id: tradeId,
                action: 'remove_item',
                reason: 'amount_required_for_non_unique_items',
                item_id: tradeItem.itemId
            });
            return res.status(400).send({ message: "Amount is required for items without _unique_id" });
        }
        try {
            await this.tradeService.removeItemFromTrade(tradeId, req.user.user_id, tradeItem);
            await this.logAction(req, 'trade_items', 200, {
                trade_id: tradeId,
                action: 'remove_item',
                item_id: tradeItem.itemId,
                amount: tradeItem.amount,
                has_metadata: !!tradeItem.metadata,
                has_unique_id: !!tradeItem.metadata?._unique_id
            });
            res.status(200).send({ message: "Item removed from trade" });
        }
        catch (error) {
            await this.logAction(req, 'trade_items', 500, {
                trade_id: tradeId,
                action: 'remove_item',
                item_id: tradeItem.itemId,
                amount: tradeItem.amount,
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error removing item from trade");
        }
    }
    async approveTrade(req, res) {
        const tradeId = req.params.id;
        try {
            await this.tradeService.approveTrade(tradeId, req.user.user_id);
            await this.logAction(req, 'trades', 200, {
                trade_id: tradeId,
                action: 'approve'
            });
            res.status(200).send({ message: "Trade approved" });
        }
        catch (error) {
            await this.logAction(req, 'trades', 500, {
                trade_id: tradeId,
                action: 'approve',
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error approving trade");
        }
    }
    async cancelTrade(req, res) {
        const tradeId = req.params.id;
        try {
            await this.tradeService.cancelTrade(tradeId, req.user.user_id);
            await this.logAction(req, 'trades', 200, {
                trade_id: tradeId,
                action: 'cancel'
            });
            res.status(200).send({ message: "Trade canceled" });
        }
        catch (error) {
            await this.logAction(req, 'trades', 500, {
                trade_id: tradeId,
                action: 'cancel',
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error canceling trade");
        }
    }
};
__decorate([
    (0, describe_1.describe)({
        endpoint: "/trades/start-or-latest/:userId",
        method: "POST",
        description: "Start a new trade or get the latest pending trade with a user",
        params: { userId: "The ID of the user to trade with" },
        responseType: {
            id: "string",
            fromUserId: "string",
            toUserId: "string",
            fromUserItems: ["object"],
            toUserItems: ["object"],
            approvedFromUser: "boolean",
            approvedToUser: "boolean",
            status: "string",
            createdAt: "string",
            updatedAt: "string"
        },
        example: "POST /api/trades/start-or-latest/user123",
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpPost)("/start-or-latest/:userId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "startOrGetPendingTrade", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/trades/:id",
        method: "GET",
        description: "Get a trade by ID with enriched item information",
        params: { id: "The ID of the trade" },
        responseType: {
            id: "string",
            fromUserId: "string",
            toUserId: "string",
            fromUserItems: [{
                    itemId: "string",
                    name: "string",
                    description: "string",
                    iconHash: "string",
                    amount: "number"
                }],
            toUserItems: [{
                    itemId: "string",
                    name: "string",
                    description: "string",
                    iconHash: "string",
                    amount: "number"
                }],
            approvedFromUser: "boolean",
            approvedToUser: "boolean",
            status: "string",
            createdAt: "string",
            updatedAt: "string"
        },
        example: "GET /api/trades/trade123",
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpGet)("/:id", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "getTradeById", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/trades/user/:userId",
        method: "GET",
        description: "Get all trades for a user with enriched item information",
        params: { userId: "The ID of the user" },
        responseType: [{
                id: "string",
                fromUserId: "string",
                toUserId: "string",
                fromUserItems: [{
                        itemId: "string",
                        name: "string",
                        description: "string",
                        iconHash: "string",
                        amount: "number"
                    }],
                toUserItems: [{
                        itemId: "string",
                        name: "string",
                        description: "string",
                        iconHash: "string",
                        amount: "number"
                    }],
                approvedFromUser: "boolean",
                approvedToUser: "boolean",
                status: "string",
                createdAt: "string",
                updatedAt: "string"
            }],
        example: "GET /api/trades/user/user123",
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpGet)("/user/:userId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "getTradesByUser", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/trades/:id/add-item",
        method: "POST",
        description: "Add an item to a trade",
        params: { id: "The ID of the trade" },
        body: {
            tradeItem: {
                itemId: "The ID of the item to add",
                amount: "The amount of the item to add",
                metadata: "Metadata object including _unique_id for unique items (optional)"
            }
        },
        responseType: { message: "string" },
        example: 'POST /api/trades/trade123/add-item {"tradeItem": {"itemId": "item456", "amount": 5}} or {"tradeItem": {"itemId": "item456", "amount": 1, "metadata": {"level": 5, "_unique_id": "abc-123"}}}',
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpPost)("/:id/add-item", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "addItemToTrade", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/trades/:id/remove-item",
        method: "POST",
        description: "Remove an item from a trade",
        params: { id: "The ID of the trade" },
        body: {
            tradeItem: {
                itemId: "The ID of the item to remove",
                amount: "The amount of the item to remove",
                metadata: "Metadata object including _unique_id for unique items (optional)"
            }
        },
        responseType: { message: "string" },
        example: 'POST /api/trades/trade123/remove-item {"tradeItem": {"itemId": "item456", "amount": 2}} or {"tradeItem": {"itemId": "item456", "metadata": {"_unique_id": "abc-123"}}}',
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpPost)("/:id/remove-item", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "removeItemFromTrade", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/trades/:id/approve",
        method: "PUT",
        description: "Approve a trade",
        params: { id: "The ID of the trade" },
        responseType: { message: "string" },
        example: "PUT /api/trades/trade123/approve",
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpPut)("/:id/approve", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "approveTrade", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/trades/:id/cancel",
        method: "PUT",
        description: "Cancel a trade",
        params: { id: "The ID of the trade" },
        responseType: { message: "string" },
        example: "PUT /api/trades/trade123/cancel",
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpPut)("/:id/cancel", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "cancelTrade", null);
Trades = __decorate([
    (0, inversify_express_utils_1.controller)("/trades"),
    __param(0, (0, inversify_1.inject)("TradeService")),
    __param(1, (0, inversify_1.inject)("LogService")),
    __metadata("design:paramtypes", [Object, Object])
], Trades);
exports.Trades = Trades;
