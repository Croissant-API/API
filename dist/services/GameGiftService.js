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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGiftService = void 0;
const inversify_1 = require("inversify");
const GameGiftRepository_1 = require("../repositories/GameGiftRepository");
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
let GameGiftService = class GameGiftService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.gameGiftRepository = new GameGiftRepository_1.GameGiftRepository(this.databaseService);
    }
    async createGift(gameId, fromUserId, message) {
        const giftId = (0, uuid_1.v4)();
        const giftCode = this.generateGiftCode();
        const createdAt = new Date();
        const gift = {
            id: giftId,
            gameId,
            fromUserId,
            giftCode,
            createdAt,
            isActive: true,
            message
        };
        await this.gameGiftRepository.insertGift(gift);
        return gift;
    }
    async claimGift(giftCode, userId) {
        const gift = await this.getGift(giftCode);
        if (!gift)
            throw new Error("Gift not found");
        if (!gift.isActive)
            throw new Error("Gift is no longer active");
        if (gift.toUserId)
            throw new Error("Gift already claimed");
        if (gift.fromUserId === userId)
            throw new Error("Cannot claim your own gift");
        const claimedAt = new Date();
        await this.gameGiftRepository.updateGiftClaim(giftCode, userId, claimedAt);
        return {
            ...gift,
            toUserId: userId,
            claimedAt,
            isActive: false
        };
    }
    async getGift(giftCode) {
        // Utilise la surcharge générique
        const gifts = await this.gameGiftRepository.getGifts({ giftCode });
        return gifts[0] || null;
    }
    async getUserSentGifts(userId) {
        // Utilise la surcharge générique
        return await this.gameGiftRepository.getGifts({ fromUserId: userId }, "createdAt DESC");
    }
    async getUserReceivedGifts(userId) {
        // Utilise la surcharge générique
        return await this.gameGiftRepository.getGifts({ toUserId: userId }, "claimedAt DESC");
    }
    async revokeGift(giftId, userId) {
        const gifts = await this.gameGiftRepository.getGifts({ giftId });
        const gift = gifts[0];
        if (!gift)
            throw new Error("Gift not found");
        if (gift.fromUserId !== userId)
            throw new Error("You can only revoke your own gifts");
        if (!gift.isActive)
            throw new Error("Gift is no longer active");
        await this.gameGiftRepository.updateGiftStatus(giftId, false);
    }
    generateGiftCode() {
        // Génère un code de 16 caractères alphanumériques
        return crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
    }
};
exports.GameGiftService = GameGiftService;
exports.GameGiftService = GameGiftService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], GameGiftService);
