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
exports.GameGifts = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
// --- UTILS ---
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
let GameGifts = class GameGifts {
    constructor(giftService, gameService, userService, logService) {
        this.giftService = giftService;
        this.gameService = gameService;
        this.userService = userService;
        this.logService = logService;
    }
    // Helper pour créer des logs (signature uniforme)
    async createLog(req, action, tableName, statusCode, userId) {
        try {
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] || req.socket.remoteAddress,
                table_name: tableName,
                controller: `GameGiftController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: req.body,
                user_id: userId,
                status_code: statusCode
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    async createGift(req, res) {
        const { gameId, message } = req.body;
        const userId = req.user.user_id;
        if (!gameId) {
            await this.createLog(req, 'createGift', 'gifts', 400, userId);
            return res.status(400).send({ message: "Game ID is required" });
        }
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                await this.createLog(req, 'createGift', 'gifts', 404, userId);
                return res.status(404).send({ message: "Game not found" });
            }
            const user = await this.userService.getUser(userId);
            if (!user) {
                await this.createLog(req, 'createGift', 'gifts', 404, userId);
                return res.status(404).send({ message: "User not found" });
            }
            if (user.balance < game.price) {
                await this.createLog(req, 'createGift', 'gifts', 400, userId);
                return res.status(400).send({
                    message: `Insufficient balance. Required: ${game.price}, Available: ${user.balance}`
                });
            }
            if (userId !== game.owner_id) {
                await this.userService.updateUserBalance(userId, user.balance - game.price);
                const owner = await this.userService.getUser(game.owner_id);
                if (owner) {
                    await this.userService.updateUserBalance(game.owner_id, owner.balance + game.price * 0.75);
                }
            }
            const gift = await this.giftService.createGift(gameId, userId, message);
            await this.createLog(req, 'createGift', 'gifts', 201, userId);
            res.status(201).send({
                message: "Gift created successfully",
                gift: {
                    id: gift.id,
                    gameId: gift.gameId,
                    giftCode: gift.giftCode,
                    createdAt: gift.createdAt,
                    message: gift.message
                }
            });
        }
        catch (error) {
            await this.createLog(req, 'createGift', 'gifts', 500, userId);
            handleError(res, error, "Error creating gift");
        }
    }
    async claimGift(req, res) {
        const { giftCode } = req.body;
        const userId = req.user.user_id;
        if (!giftCode) {
            await this.createLog(req, 'claimGift', 'gifts', 400, userId);
            return res.status(400).send({ message: "Gift code is required" });
        }
        try {
            const gift = await this.giftService.getGift(giftCode);
            if (!gift) {
                await this.createLog(req, 'claimGift', 'gifts', 404, userId);
                return res.status(404).send({ message: "Invalid gift code" });
            }
            const userOwnsGame = await this.gameService.userOwnsGame(gift.gameId, userId);
            if (userOwnsGame) {
                await this.createLog(req, 'claimGift', 'gifts', 400, userId);
                return res.status(400).send({ message: "You already own this game" });
            }
            const claimedGift = await this.giftService.claimGift(giftCode, userId);
            await this.gameService.addOwner(gift.gameId, userId);
            await this.createLog(req, 'claimGift', 'gifts', 200, userId);
            res.status(200).send({
                message: "Gift claimed successfully",
                gift: claimedGift
            });
        }
        catch (error) {
            await this.createLog(req, 'claimGift', 'gifts', 400, userId);
            handleError(res, error, "Error claiming gift", 400);
        }
    }
    async getSentGifts(req, res) {
        try {
            const gifts = await this.giftService.getUserSentGifts(req.user.user_id);
            const enrichedGifts = await Promise.all(gifts.map(async (gift) => {
                const game = await this.gameService.getGameForPublic(gift.gameId);
                return {
                    ...gift,
                    game
                };
            }));
            await this.createLog(req, 'getSentGifts', 'gifts', 200, req.user.user_id);
            res.send(enrichedGifts);
        }
        catch (error) {
            await this.createLog(req, 'getSentGifts', 'gifts', 500, req.user.user_id);
            handleError(res, error, "Error fetching sent gifts");
        }
    }
    async getReceivedGifts(req, res) {
        try {
            const gifts = await this.giftService.getUserReceivedGifts(req.user.user_id);
            const enrichedGifts = await Promise.all(gifts.map(async (gift) => {
                const game = await this.gameService.getGameForPublic(gift.gameId);
                const fromUser = await this.userService.getUser(gift.fromUserId);
                return {
                    ...gift,
                    game,
                    fromUser: fromUser ? { id: fromUser.user_id, username: fromUser.username } : null
                };
            }));
            await this.createLog(req, 'getReceivedGifts', 'gifts', 200, req.user.user_id);
            res.send(enrichedGifts);
        }
        catch (error) {
            await this.createLog(req, 'getReceivedGifts', 'gifts', 500, req.user.user_id);
            handleError(res, error, "Error fetching received gifts");
        }
    }
    async getGiftInfo(req, res) {
        const { giftCode } = req.params;
        try {
            const gift = await this.giftService.getGift(giftCode);
            if (!gift) {
                await this.createLog(req, 'getGiftInfo', 'gifts', 404, req.user.user_id);
                return res.status(404).send({ message: "Gift not found" });
            }
            const game = await this.gameService.getGameForPublic(gift.gameId);
            const fromUser = await this.userService.getUser(gift.fromUserId);
            const userOwnsGame = await this.gameService.userOwnsGame(gift.gameId, req.user.user_id);
            await this.createLog(req, 'getGiftInfo', 'gifts', 200, req.user.user_id);
            res.send({
                gift: {
                    gameId: gift.gameId,
                    giftCode: gift.giftCode,
                    createdAt: gift.createdAt,
                    claimedAt: gift.claimedAt,
                    isActive: gift.isActive,
                    message: gift.message
                },
                game,
                fromUser: fromUser ? { id: fromUser.user_id, username: fromUser.username } : null,
                userOwnsGame
            });
        }
        catch (error) {
            await this.createLog(req, 'getGiftInfo', 'gifts', 500, req.user.user_id);
            handleError(res, error, "Error fetching gift info");
        }
    }
    async revokeGift(req, res) {
        const { giftId } = req.params;
        const userId = req.user.user_id;
        try {
            const gifts = await this.giftService.getUserSentGifts(userId);
            const gift = gifts.find(g => g.id === giftId);
            if (!gift) {
                await this.createLog(req, 'revokeGift', 'gifts', 404, userId);
                return res.status(404).send({ message: "Gift not found" });
            }
            if (!gift.isActive) {
                await this.createLog(req, 'revokeGift', 'gifts', 400, userId);
                return res.status(400).send({ message: "Gift is no longer active" });
            }
            await this.giftService.revokeGift(giftId, userId);
            const game = await this.gameService.getGame(gift.gameId);
            if (game) {
                const user = await this.userService.getUser(userId);
                if (user) {
                    await this.userService.updateUserBalance(userId, user.balance + game.price);
                }
                const owner = await this.userService.getUser(game.owner_id);
                if (owner) {
                    await this.userService.updateUserBalance(game.owner_id, owner.balance - game.price * 0.75);
                }
            }
            await this.createLog(req, 'revokeGift', 'gifts', 200, userId);
            res.send({ message: "Gift revoked successfully and refund processed" });
        }
        catch (error) {
            await this.createLog(req, 'revokeGift', 'gifts', 400, userId);
            handleError(res, error, "Error revoking gift", 400);
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpPost)("/create", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GameGifts.prototype, "createGift", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/claim", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GameGifts.prototype, "claimGift", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/sent", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GameGifts.prototype, "getSentGifts", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/received", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GameGifts.prototype, "getReceivedGifts", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/:giftCode", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GameGifts.prototype, "getGiftInfo", null);
__decorate([
    (0, inversify_express_utils_1.httpDelete)("/:giftId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GameGifts.prototype, "revokeGift", null);
GameGifts = __decorate([
    (0, inversify_express_utils_1.controller)("/gifts"),
    __param(0, (0, inversify_1.inject)("GameGiftService")),
    __param(1, (0, inversify_1.inject)("GameService")),
    __param(2, (0, inversify_1.inject)("UserService")),
    __param(3, (0, inversify_1.inject)("LogService")),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], GameGifts);
exports.GameGifts = GameGifts;
