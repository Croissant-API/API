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
let GameGifts = class GameGifts {
    constructor(giftService, gameService, userService) {
        this.giftService = giftService;
        this.gameService = gameService;
        this.userService = userService;
    }
    async createGift(req, res) {
        const { gameId, message } = req.body;
        const userId = req.user.user_id;
        if (!gameId) {
            return res.status(400).send({ message: "Game ID is required" });
        }
        try {
            // Vérifier que le jeu existe
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                return res.status(404).send({ message: "Game not found" });
            }
            // Vérifier le solde de l'utilisateur
            const user = await this.userService.getUser(userId);
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }
            if (user.balance < game.price) {
                return res.status(400).send({
                    message: `Insufficient balance. Required: ${game.price}, Available: ${user.balance}`
                });
            }
            // Ne pas débiter ni créditer si l'utilisateur est le propriétaire du jeu
            if (userId !== game.owner_id) {
                // Débiter le montant du compte de l'utilisateur
                await this.userService.updateUserBalance(userId, user.balance - game.price);
                // Créditer le propriétaire du jeu (75% du prix)
                const owner = await this.userService.getUser(game.owner_id);
                if (owner) {
                    await this.userService.updateUserBalance(game.owner_id, owner.balance + game.price * 0.75);
                }
            }
            // Créer le gift
            const gift = await this.giftService.createGift(gameId, userId, message);
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
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error creating gift", error: msg });
        }
    }
    async claimGift(req, res) {
        const { giftCode } = req.body;
        const userId = req.user.user_id;
        if (!giftCode) {
            return res.status(400).send({ message: "Gift code is required" });
        }
        try {
            // Vérifier que le gift existe
            const gift = await this.giftService.getGift(giftCode);
            if (!gift) {
                return res.status(404).send({ message: "Invalid gift code" });
            }
            // Vérifier que l'utilisateur ne possède pas déjà le jeu
            const userOwnsGame = await this.gameService.userOwnsGame(gift.gameId, userId);
            if (userOwnsGame) {
                return res.status(400).send({ message: "You already own this game" });
            }
            // Réclamer le gift
            const claimedGift = await this.giftService.claimGift(giftCode, userId);
            // Ajouter le jeu à la bibliothèque de l'utilisateur
            await this.gameService.addOwner(gift.gameId, userId);
            res.status(200).send({
                message: "Gift claimed successfully",
                gift: claimedGift
            });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            res.status(400).send({ message: msg });
        }
    }
    async getSentGifts(req, res) {
        try {
            const gifts = await this.giftService.getUserSentGifts(req.user.user_id);
            // Enrichir avec les informations des jeux
            const enrichedGifts = await Promise.all(gifts.map(async (gift) => {
                const game = await this.gameService.getGameForPublic(gift.gameId);
                return {
                    ...gift,
                    game
                };
            }));
            res.send(enrichedGifts);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error fetching sent gifts", error: msg });
        }
    }
    async getReceivedGifts(req, res) {
        try {
            const gifts = await this.giftService.getUserReceivedGifts(req.user.user_id);
            // Enrichir avec les informations des jeux et utilisateurs
            const enrichedGifts = await Promise.all(gifts.map(async (gift) => {
                const game = await this.gameService.getGameForPublic(gift.gameId);
                const fromUser = await this.userService.getUser(gift.fromUserId);
                return {
                    ...gift,
                    game,
                    fromUser: fromUser ? { id: fromUser.user_id, username: fromUser.username } : null
                };
            }));
            res.send(enrichedGifts);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error fetching received gifts", error: msg });
        }
    }
    async getGiftInfo(req, res) {
        const { giftCode } = req.params;
        try {
            const gift = await this.giftService.getGift(giftCode);
            if (!gift) {
                return res.status(404).send({ message: "Gift not found" });
            }
            const game = await this.gameService.getGameForPublic(gift.gameId);
            const fromUser = await this.userService.getUser(gift.fromUserId);
            // Vérifier si l'utilisateur actuel possède déjà le jeu
            const userOwnsGame = await this.gameService.userOwnsGame(gift.gameId, req.user.user_id);
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
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error fetching gift info", error: msg });
        }
    }
    async revokeGift(req, res) {
        const { giftId } = req.params;
        const userId = req.user.user_id;
        try {
            // Récupérer les infos du gift avant de le révoquer
            const gifts = await this.giftService.getUserSentGifts(userId);
            const gift = gifts.find(g => g.id === giftId);
            if (!gift) {
                return res.status(404).send({ message: "Gift not found" });
            }
            if (!gift.isActive) {
                return res.status(400).send({ message: "Gift is no longer active" });
            }
            // Révoquer le gift
            await this.giftService.revokeGift(giftId, userId);
            // Rembourser l'utilisateur
            const game = await this.gameService.getGame(gift.gameId);
            if (game) {
                const user = await this.userService.getUser(userId);
                if (user) {
                    await this.userService.updateUserBalance(userId, user.balance + game.price);
                }
                // Débiter le propriétaire du jeu (75% du prix)
                const owner = await this.userService.getUser(game.owner_id);
                if (owner) {
                    await this.userService.updateUserBalance(game.owner_id, owner.balance - game.price * 0.75);
                }
            }
            res.send({ message: "Gift revoked successfully and refund processed" });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            res.status(400).send({ message: msg });
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
    __metadata("design:paramtypes", [Object, Object, Object])
], GameGifts);
exports.GameGifts = GameGifts;
