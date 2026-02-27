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
import { GameViewRepository } from '../repositories/GameViewRepository';
let GameViewService = class GameViewService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.gameViewRepository = new GameViewRepository(this.databaseService);
    }
    async addView(gameId, viewerCookie, ipAddress, userAgent) {
        await this.gameViewRepository.addView(gameId, viewerCookie, ipAddress, userAgent);
    }
    async hasViewedToday(gameId, viewerCookie) {
        return this.gameViewRepository.hasViewedToday(gameId, viewerCookie);
    }
    async getGameViewStats(gameId) {
        return this.gameViewRepository.getGameViewStats(gameId);
    }
    async getViewsForGames(gameIds) {
        return this.gameViewRepository.getViewsForGames(gameIds);
    }
    async cleanupOldViews(daysToKeep = 365) {
        await this.gameViewRepository.cleanupOldViews(daysToKeep);
    }
};
GameViewService = __decorate([
    injectable(),
    __param(0, inject('DatabaseService')),
    __metadata("design:paramtypes", [Object])
], GameViewService);
export { GameViewService };
