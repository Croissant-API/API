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
/* eslint-disable @typescript-eslint/no-unused-vars */
import { inject, injectable } from 'inversify';
import { GameRepository } from '../repositories/GameRepository';
import { BadgeService } from './BadgeService';
import { GameViewService } from './GameViewService';
let GameService = class GameService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.gameRepository = new GameRepository(this.databaseService);
        this.badgeService = new BadgeService(this.databaseService);
        this.gameViewService = new GameViewService(this.databaseService);
    }
    async getGame(gameId) {
        return this.gameRepository.getGame(gameId);
    }
    async getGameForPublic(gameId) {
        return this.gameRepository.getGameForPublic(gameId);
    }
    async getGameForOwner(gameId, userId) {
        const game = await this.gameRepository.getGameForOwner(gameId, userId);
        return game ? { ...game, download_link: `/api/games/${gameId}/download` } : null;
    }
    async getUserGames(userId) {
        const games = await this.gameRepository.getUserGames(userId);
        return games.map(game => ({ ...game, download_link: `/api/games/${game.gameId}/download` }));
    }
    async listGames() {
        return this.gameRepository.listGames();
    }
    async getStoreGames() {
        return this.gameRepository.getStoreGames();
    }
    async getMyCreatedGames(userId) {
        return this.gameRepository.getMyCreatedGames(userId);
    }
    async getUserOwnedGames(userId) {
        const games = await this.gameRepository.getUserOwnedGames(userId);
        return games.map(game => ({ ...game, download_link: `/api/games/${game.gameId}/download` }));
    }
    async searchGames(query) {
        return this.gameRepository.searchGames(query);
    }
    async createGame(game) {
        await this.gameRepository.createGame(game);
        // Ajouter le badge "nouveau" pour 10 jours
        try {
            await this.badgeService.addBadgeToGame(game.gameId, 'nouveau');
        }
        catch (error) {
            console.error("Error adding 'nouveau' badge to game:", error);
        }
    }
    async updateGame(gameId, game) {
        const { fields, values } = buildUpdateFields(game, ['owners', 'markAsUpdated']);
        if (fields.length)
            await this.gameRepository.updateGame(gameId, fields, values);
        // Si markAsUpdated est true, ajouter le badge "mise-a-jour"
        if (game.markAsUpdated) {
            try {
                await this.badgeService.addBadgeToGame(gameId, 'mise-a-jour');
            }
            catch (error) {
                console.error("Error adding 'mise-a-jour' badge to game:", error);
            }
        }
    }
    async deleteGame(gameId) {
        await this.gameRepository.deleteGame(gameId);
    }
    async addOwner(gameId, ownerId) {
        await this.gameRepository.addOwner(gameId, ownerId);
    }
    async removeOwner(gameId, ownerId) {
        await this.gameRepository.removeOwner(gameId, ownerId);
    }
    async transferOwnership(gameId, newOwnerId) {
        const game = await this.getGame(gameId);
        if (!game)
            throw new Error('Game not found');
        await this.updateGame(gameId, { owner_id: newOwnerId });
    }
    async canUserGiftGame() {
        return true;
    }
    async userOwnsGame(gameId, userId) {
        const games = await this.getUserGames(userId);
        return games.some(game => game.gameId === gameId);
    }
    async transferGameCopy(gameId, fromUserId, toUserId) {
        const [fromOwns, toOwns, game] = await Promise.all([this.userOwnsGame(gameId, fromUserId), this.userOwnsGame(gameId, toUserId), this.getGame(gameId)]);
        if (!fromOwns)
            throw new Error("You don't own this game");
        if (toOwns)
            throw new Error('Recipient already owns this game');
        if (!game)
            throw new Error('Game not found');
        if (game.owner_id === fromUserId)
            throw new Error('Game creator cannot transfer their copy');
        await this.removeOwner(gameId, fromUserId);
        await this.addOwner(gameId, toUserId);
    }
    async canTransferGame(gameId, fromUserId, toUserId) {
        const [fromOwns, toOwns, game] = await Promise.all([this.userOwnsGame(gameId, fromUserId), this.userOwnsGame(gameId, toUserId), this.getGame(gameId)]);
        if (!fromOwns)
            return { canTransfer: false, reason: "You don't own this game" };
        if (toOwns)
            return { canTransfer: false, reason: 'Recipient already owns this game' };
        if (!game)
            return { canTransfer: false, reason: 'Game not found' };
        if (game.owner_id === fromUserId)
            return { canTransfer: false, reason: 'Game creator cannot transfer their copy' };
        return { canTransfer: true };
    }
    async getGameWithBadgesAndViews(gameId) {
        const game = await this.getGame(gameId);
        if (!game)
            return null;
        const [badges, views] = await Promise.all([this.badgeService.getActiveBadgesForGame(gameId), this.gameViewService.getGameViewStats(gameId)]);
        const { download_link, ...gameWithoutDownloadLink } = game;
        return {
            ...gameWithoutDownloadLink,
            badges,
            views,
        };
    }
    async getGamesWithBadgesAndViews(gameIds) {
        if (gameIds.length === 0)
            return [];
        const [games, viewsMap] = await Promise.all([Promise.all(gameIds.map(id => this.getGame(id))), this.gameViewService.getViewsForGames(gameIds)]);
        const results = [];
        for (let i = 0; i < games.length; i++) {
            const game = games[i];
            if (game) {
                const badges = await this.badgeService.getActiveBadgesForGame(game.gameId);
                const views = viewsMap[game.gameId] || {
                    gameId: game.gameId,
                    total_views: 0,
                    unique_views: 0,
                    views_today: 0,
                    views_this_week: 0,
                    views_this_month: 0,
                };
                const { download_link, ...gameWithoutDownloadLink } = game;
                results.push({
                    ...gameWithoutDownloadLink,
                    badges,
                    views,
                });
            }
        }
        return results;
    }
};
GameService = __decorate([
    injectable(),
    __param(0, inject('DatabaseService')),
    __metadata("design:paramtypes", [Object])
], GameService);
export { GameService };
function toDbBool(val) {
    return val ? 1 : 0;
}
function buildUpdateFields(obj, skip = []) {
    const fields = [];
    const values = [];
    for (const key in obj) {
        if (skip.includes(key))
            continue;
        fields.push(`${key} = ?`);
        values.push(['showInStore', 'multiplayer'].includes(key) ? toDbBool(obj[key]) : obj[key]);
    }
    return { fields, values };
}
