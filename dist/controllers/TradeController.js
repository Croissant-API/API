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
const TradeValidator_1 = require("../validators/TradeValidator");
const yup_1 = require("yup");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
async function validateOr400(schema, data, res) {
    try {
        await schema.validate(data, { abortEarly: false });
        return true;
    }
    catch (error) {
        if (error instanceof yup_1.ValidationError) {
            res.status(400).send({ message: "Validation failed", errors: error.errors });
            return false;
        }
        throw error;
    }
}
let Trades = class Trades {
    constructor(tradeService) {
        this.tradeService = tradeService;
    }
    // --- Démarrage ou récupération de trade ---
    async startOrGetPendingTrade(req, res) {
        try {
            const fromUserId = req.user.user_id;
            const toUserId = req.params.userId;
            if (fromUserId === toUserId) {
                return res.status(400).send({ message: "Cannot trade with yourself" });
            }
            const trade = await this.tradeService.startOrGetPendingTrade(fromUserId, toUserId);
            res.status(200).send(trade);
        }
        catch (error) {
            handleError(res, error, "Error starting or getting trade");
        }
    }
    // --- Lecture ---
    async getTradeById(req, res) {
        try {
            const id = req.params.id;
            const trade = await this.tradeService.getTradeById(id);
            if (!trade) {
                return res.status(404).send({ message: "Trade not found" });
            }
            if (trade.fromUserId !== req.user.user_id &&
                trade.toUserId !== req.user.user_id) {
                return res.status(403).send({ message: "Forbidden" });
            }
            res.send(trade);
        }
        catch (error) {
            handleError(res, error, "Error fetching trade");
        }
    }
    async getTradesByUser(req, res) {
        try {
            const userId = req.params.userId;
            if (userId !== req.user.user_id) {
                return res.status(403).send({ message: "Forbidden" });
            }
            const trades = await this.tradeService.getTradesByUser(userId);
            res.send(trades);
        }
        catch (error) {
            handleError(res, error, "Error fetching trades");
        }
    }
    // --- Actions sur une trade ---
    async addItemToTrade(req, res) {
        if (!(await validateOr400(TradeValidator_1.tradeItemActionSchema, req.body, res)))
            return;
        try {
            const tradeId = req.params.id;
            const { tradeItem } = req.body;
            await this.tradeService.addItemToTrade(tradeId, req.user.user_id, tradeItem);
            res.status(200).send({ message: "Item added to trade" });
        }
        catch (error) {
            handleError(res, error, "Error adding item to trade");
        }
    }
    async removeItemFromTrade(req, res) {
        if (!(await validateOr400(TradeValidator_1.tradeItemActionSchema, req.body, res)))
            return;
        try {
            const tradeId = req.params.id;
            const { tradeItem } = req.body;
            await this.tradeService.removeItemFromTrade(tradeId, req.user.user_id, tradeItem);
            res.status(200).send({ message: "Item removed from trade" });
        }
        catch (error) {
            handleError(res, error, "Error removing item from trade");
        }
    }
    async approveTrade(req, res) {
        try {
            const tradeId = req.params.id;
            await this.tradeService.approveTrade(tradeId, req.user.user_id);
            res.status(200).send({ message: "Trade approved" });
        }
        catch (error) {
            handleError(res, error, "Error approving trade");
        }
    }
    async cancelTrade(req, res) {
        try {
            const tradeId = req.params.id;
            await this.tradeService.cancelTrade(tradeId, req.user.user_id);
            res.status(200).send({ message: "Trade canceled" });
        }
        catch (error) {
            handleError(res, error, "Error canceling trade");
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpPost)("/start-or-latest/:userId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "startOrGetPendingTrade", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/:id", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "getTradeById", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/user/:userId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "getTradesByUser", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/:id/add-item", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "addItemToTrade", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/:id/remove-item", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "removeItemFromTrade", null);
__decorate([
    (0, inversify_express_utils_1.httpPut)("/:id/approve", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "approveTrade", null);
__decorate([
    (0, inversify_express_utils_1.httpPut)("/:id/cancel", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "cancelTrade", null);
Trades = __decorate([
    (0, inversify_express_utils_1.controller)("/trades"),
    __param(0, (0, inversify_1.inject)("TradeService")),
    __metadata("design:paramtypes", [Object])
], Trades);
exports.Trades = Trades;
