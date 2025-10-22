"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadgeService = void 0;
const inversify_1 = require("inversify");
const BadgeRepository_1 = require("../repositories/BadgeRepository");
let BadgeService = class BadgeService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.badgeRepository = new BadgeRepository_1.BadgeRepository(this.databaseService);
    }
    async getActiveBadgesForGame(gameId) {
        return this.badgeRepository.getActiveBadgesForGame(gameId);
    }
    async addBadgeToGame(gameId, badgeName) {
        const badgeType = await this.badgeRepository.getBadgeTypeByName(badgeName);
        if (!badgeType) {
            throw new Error(`Badge type '${badgeName}' not found`);
        }
        await this.badgeRepository.addBadgeToGame(gameId, badgeType.id, badgeType.duration_days);
    }
    async removeExpiredBadges() {
        await this.badgeRepository.removeExpiredBadges();
    }
    async getBadgeTypes() {
        return this.badgeRepository.getBadgeTypes();
    }
};
exports.BadgeService = BadgeService;
exports.BadgeService = BadgeService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)('DatabaseService'))
], BadgeService);
