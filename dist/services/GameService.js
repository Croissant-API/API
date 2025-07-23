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
        const games = await this.listGames();
        const rows = await this.databaseService.read("SELECT gameId FROM game_owners WHERE ownerId = ?", [userId]);
        const gameIds = rows.map((row) => row.gameId);
        const filteredGames = games.filter((game) => gameIds.includes(game.gameId));
        return filteredGames;
    }
    async listGames() {
        const games = await this.databaseService.read("SELECT * FROM games");
        return games;
    }
    async createGame(game) {
        await this.databaseService.update(`INSERT INTO games (
                gameId, name, description, price, owner_id, showInStore, download_link,
                iconHash, splashHash, bannerHash, genre, release_date, developer,
                publisher, platforms, rating, website, trailer_link, multiplayer
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            game.gameId,
            game.name,
            game.description,
            game.price,
            game.owner_id,
            toDbBool(game.showInStore),
            game.download_link,
            game.iconHash ?? null,
            game.splashHash ?? null,
            game.bannerHash ?? null,
            game.genre ?? null,
            game.release_date ?? null,
            game.developer ?? null,
            game.publisher ?? null,
            game.platforms ?? null,
            game.rating ?? 0,
            game.website ?? null,
            game.trailer_link ?? null,
            toDbBool(game.multiplayer),
        ]);
    }
    async updateGame(gameId, game) {
        const { fields, values } = buildUpdateFields(game, ["owners"]);
        if (!fields.length)
            return;
        values.push(gameId);
        await this.databaseService.update(`UPDATE games SET ${fields.join(", ")} WHERE gameId = ?`, values);
    }
    async deleteGame(gameId) {
        await this.databaseService.update("DELETE FROM games WHERE gameId = ?", [gameId]);
        await this.databaseService.update("DELETE FROM game_owners WHERE gameId = ?", [gameId]);
    }
    async addOwner(gameId, ownerId) {
        await this.databaseService.update("INSERT INTO game_owners (gameId, ownerId) VALUES (?, ?)", [gameId, ownerId]);
    }
    async removeOwner(gameId, ownerId) {
        await this.databaseService.update("DELETE FROM game_owners WHERE gameId = ? AND ownerId = ?", [gameId, ownerId]);
    }
    async transferOwnership(gameId, newOwnerId) {
        const game = await this.getGame(gameId);
        if (!game)
            throw new Error("Game not found");
        await this.updateGame(gameId, { owner_id: newOwnerId });
    }
};
GameService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], GameService);
exports.GameService = GameService;
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
