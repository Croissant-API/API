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
/* eslint-disable @typescript-eslint/no-explicit-any */
const inversify_1 = require("inversify");
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
let GameGiftService = class GameGiftService {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async createGift(gameId, fromUserId, message) {
        const giftId = (0, uuid_1.v4)();
        const giftCode = this.generateGiftCode();
        const createdAt = new Date();
        await this.databaseService.update(`INSERT INTO game_gifts (id, gameId, fromUserId, giftCode, createdAt, isActive, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [giftId, gameId, fromUserId, giftCode, createdAt.toISOString(), 1, message || null]);
        return {
            id: giftId,
            gameId,
            fromUserId,
            giftCode,
            createdAt,
            isActive: true,
            message
        };
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
        await this.databaseService.update(`UPDATE game_gifts SET toUserId = ?, claimedAt = ?, isActive = 0 WHERE giftCode = ?`, [userId, claimedAt.toISOString(), giftCode]);
        return {
            ...gift,
            toUserId: userId,
            claimedAt,
            isActive: false
        };
    }
    async getGift(giftCode) {
        const rows = await this.databaseService.read(`SELECT * FROM game_gifts WHERE giftCode = ?`, [giftCode]);
        if (rows.length === 0)
            return null;
        const row = rows[0];
        return {
            id: row.id,
            gameId: row.gameId,
            fromUserId: row.fromUserId,
            toUserId: row.toUserId,
            giftCode: row.giftCode,
            createdAt: new Date(row.createdAt),
            claimedAt: row.claimedAt ? new Date(row.claimedAt) : undefined,
            isActive: Boolean(row.isActive),
            message: row.message
        };
    }
    async getUserSentGifts(userId) {
        const rows = await this.databaseService.read(`SELECT * FROM game_gifts WHERE fromUserId = ? ORDER BY createdAt DESC`, [userId]);
        return rows.map((row) => ({
            id: row.id,
            gameId: row.gameId,
            fromUserId: row.fromUserId,
            toUserId: row.toUserId,
            giftCode: row.giftCode,
            createdAt: new Date(row.createdAt),
            claimedAt: row.claimedAt ? new Date(row.claimedAt) : undefined,
            isActive: Boolean(row.isActive),
            message: row.message
        }));
    }
    async getUserReceivedGifts(userId) {
        const rows = await this.databaseService.read(`SELECT * FROM game_gifts WHERE toUserId = ? ORDER BY claimedAt DESC`, [userId]);
        return rows.map((row) => ({
            id: row.id,
            gameId: row.gameId,
            fromUserId: row.fromUserId,
            toUserId: row.toUserId,
            giftCode: row.giftCode,
            createdAt: new Date(row.createdAt),
            claimedAt: row.claimedAt ? new Date(row.claimedAt) : undefined,
            isActive: Boolean(row.isActive),
            message: row.message
        }));
    }
    async revokeGift(giftId, userId) {
        const gift = await this.databaseService.read(`SELECT * FROM game_gifts WHERE id = ?`, [giftId]);
        if (gift.length === 0)
            throw new Error("Gift not found");
        if (gift[0].fromUserId !== userId)
            throw new Error("You can only revoke your own gifts");
        if (!gift[0].isActive)
            throw new Error("Gift is no longer active");
        await this.databaseService.update(`UPDATE game_gifts SET isActive = 0 WHERE id = ?`, [giftId]);
    }
    generateGiftCode() {
        // Génère un code de 16 caractères alphanumériques
        return crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
    }
};
GameGiftService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], GameGiftService);
exports.GameGiftService = GameGiftService;
