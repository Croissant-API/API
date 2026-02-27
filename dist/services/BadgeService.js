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
import { inject, injectable } from 'inversify';
import { BadgeRepository } from '../repositories/BadgeRepository';
let BadgeService = class BadgeService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.badgeRepository = new BadgeRepository(this.databaseService);
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
BadgeService = __decorate([
    injectable(),
    __param(0, inject('DatabaseService')),
    __metadata("design:paramtypes", [Object])
], BadgeService);
export { BadgeService };
