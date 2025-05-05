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
let GameService = class GameService {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getGame(gameId) {
        const rows = await this.databaseService.read("SELECT * FROM games WHERE gameId = ?", [gameId]);
        if (rows.length === 0)
            return null;
        const game = rows[0];
        return { ...game };
    }
    async getUserGames(userId) {
        const rows = await this.databaseService.read("SELECT g.* FROM games g INNER JOIN game_owners go ON g.gameId = go.gameId WHERE go.ownerId = ?", [userId]);
        return rows.map((game) => ({ ...game }));
    }
    async listGames() {
        const games = await this.databaseService.read("SELECT * FROM games");
        return games;
    }
    async createGame(game) {
        await this.databaseService.update("INSERT INTO games (gameId, name, description, price, owner_id, showInStore) VALUES (?, ?, ?, ?, ?, ?)", [
            game.gameId,
            game.name,
            game.description,
            game.price,
            game.ownerId,
            game.showInStore ? 1 : 0
        ]);
    }
    async updateGame(gameId, game) {
        const fields = [];
        const values = [];
        for (const key in game) {
            if (key === "owners")
                continue; // Ne pas updater les owners ici
            fields.push(`${key} = ?`);
            values.push(key === "showInStore"
                ? (game[key] ? 1 : 0)
                : game[key]);
        }
        if (fields.length === 0)
            return;
        values.push(gameId);
        await this.databaseService.update(`UPDATE games SET ${fields.join(", ")} WHERE gameId = ?`, values);
    }
    async deleteGame(gameId) {
        await this.databaseService.update("DELETE FROM games WHERE gameId = ?", [gameId]);
        await this.databaseService.update("DELETE FROM game_owners WHERE gameId = ?", [gameId]);
    }
    // Méthodes pour gérer les owners secondaires
    async addOwner(gameId, ownerId) {
        await this.databaseService.update("INSERT INTO game_owners (gameId, ownerId) VALUES (?, ?)", [gameId, ownerId]);
    }
    async removeOwner(gameId, ownerId) {
        await this.databaseService.update("DELETE FROM game_owners WHERE gameId = ? AND ownerId = ?", [gameId, ownerId]);
    }
};
GameService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], GameService);
exports.GameService = GameService;
