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
exports.GameService = void 0;
const inversify_1 = require("inversify");
const GameRepository_1 = require("../repositories/GameRepository");
let GameService = class GameService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.gameRepository = new GameRepository_1.GameRepository(this.databaseService);
    }
    async getGame(gameId) {
        return await this.gameRepository.getGame(gameId);
    }
    /**
     * Get game with public fields only (no download_link)
     */
    async getGameForPublic(gameId) {
        return await this.gameRepository.getGameForPublic(gameId);
    }
    /**
     * Get game with download_link if user owns it or is the creator
     */
    async getGameForOwner(gameId, userId) {
        const game = await this.gameRepository.getGameForOwner(gameId, userId);
        if (!game)
            return null;
        game.download_link = `/api/games/${gameId}/download`;
        return game;
    }
    async getUserGames(userId) {
        const games = await this.gameRepository.getUserGames(userId);
        return games.map(game => ({
            ...game,
            download_link: `/api/games/${game.gameId}/download`
        }));
    }
    async listGames() {
        return await this.gameRepository.listGames();
    }
    async getStoreGames() {
        return await this.gameRepository.getStoreGames();
    }
    async getMyCreatedGames(userId) {
        return await this.gameRepository.getMyCreatedGames(userId);
    }
    async getUserOwnedGames(userId) {
        const games = await this.gameRepository.getUserOwnedGames(userId);
        return games.map(game => ({
            ...game,
            download_link: `/api/games/${game.gameId}/download`
        }));
    }
    async searchGames(query) {
        return await this.gameRepository.searchGames(query);
    }
    async createGame(game) {
        await this.gameRepository.createGame(game);
    }
    async updateGame(gameId, game) {
        const { fields, values } = buildUpdateFields(game, ["owners"]);
        if (!fields.length)
            return;
        await this.gameRepository.updateGame(gameId, fields, values);
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
            throw new Error("Game not found");
        await this.updateGame(gameId, { owner_id: newOwnerId });
    }
    async canUserGiftGame() {
        // Pour créer un gift, l'utilisateur doit juste avoir assez de crédits
        // Il n'a pas besoin de posséder le jeu
        return true;
    }
    async userOwnsGame(gameId, userId) {
        const userGames = await this.getUserGames(userId);
        return userGames.some(game => game.gameId === gameId);
    }
    async transferGameCopy(gameId, fromUserId, toUserId) {
        // Vérifier que l'expéditeur possède le jeu
        const fromUserOwns = await this.userOwnsGame(gameId, fromUserId);
        if (!fromUserOwns) {
            throw new Error("You don't own this game");
        }
        // Vérifier que le destinataire ne possède pas déjà le jeu
        const toUserOwns = await this.userOwnsGame(gameId, toUserId);
        if (toUserOwns) {
            throw new Error("Recipient already owns this game");
        }
        // Vérifier que l'expéditeur n'est pas le créateur du jeu
        const game = await this.getGame(gameId);
        if (!game) {
            throw new Error("Game not found");
        }
        if (game.owner_id === fromUserId) {
            throw new Error("Game creator cannot transfer their copy");
        }
        // Effectuer le transfert
        await this.removeOwner(gameId, fromUserId);
        await this.addOwner(gameId, toUserId);
    }
    async canTransferGame(gameId, fromUserId, toUserId) {
        // Vérifier que l'expéditeur possède le jeu
        const fromUserOwns = await this.userOwnsGame(gameId, fromUserId);
        if (!fromUserOwns) {
            return { canTransfer: false, reason: "You don't own this game" };
        }
        // Vérifier que le destinataire ne possède pas déjà le jeu
        const toUserOwns = await this.userOwnsGame(gameId, toUserId);
        if (toUserOwns) {
            return { canTransfer: false, reason: "Recipient already owns this game" };
        }
        // Vérifier que l'expéditeur n'est pas le créateur du jeu
        const game = await this.getGame(gameId);
        if (!game) {
            return { canTransfer: false, reason: "Game not found" };
        }
        if (game.owner_id === fromUserId) {
            return { canTransfer: false, reason: "Game creator cannot transfer their copy" };
        }
        return { canTransfer: true };
    }
};
exports.GameService = GameService;
exports.GameService = GameService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], GameService);
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
        values.push(["showInStore", "multiplayer"].includes(key)
            ? toDbBool(obj[key])
            : obj[key]);
    }
    return { fields, values };
}
