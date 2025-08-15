"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRepository = void 0;
class GameRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getGame(gameId) {
        const rows = await this.databaseService.read("SELECT * FROM games WHERE gameId = ?", [gameId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getGameForPublic(gameId) {
        const rows = await this.databaseService.read(`SELECT gameId, name, description, price, owner_id, showInStore, 
              iconHash, splashHash, bannerHash, genre, release_date, 
              developer, publisher, platforms, rating, website, 
              trailer_link, multiplayer
       FROM games 
       WHERE gameId = ?`, [gameId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getGameForOwner(gameId, userId) {
        const rows = await this.databaseService.read(`SELECT g.*,
              CASE 
                WHEN g.owner_id = ? OR go.ownerId IS NOT NULL 
                THEN 1 ELSE 0 
              END as can_download
       FROM games g 
       LEFT JOIN game_owners go ON g.gameId = go.gameId AND go.ownerId = ?
       WHERE g.gameId = ?`, [userId, userId, gameId]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getUserGames(userId) {
        return await this.databaseService.read(`SELECT g.* 
       FROM games g 
       INNER JOIN game_owners go ON g.gameId = go.gameId 
       WHERE go.ownerId = ?`, [userId]);
    }
    async listGames() {
        return await this.databaseService.read("SELECT * FROM games");
    }
    async getStoreGames() {
        return await this.databaseService.read(`SELECT gameId, name, description, price, owner_id, showInStore, 
              iconHash, splashHash, bannerHash, genre, release_date, 
              developer, publisher, platforms, rating, website, 
              trailer_link, multiplayer
       FROM games 
       WHERE showInStore = 1`);
    }
    async getMyCreatedGames(userId) {
        return await this.databaseService.read(`SELECT g.*, g.download_link
       FROM games g 
       WHERE g.owner_id = ?`, [userId]);
    }
    async getUserOwnedGames(userId) {
        return await this.databaseService.read(`SELECT g.* 
       FROM games g 
       INNER JOIN game_owners go ON g.gameId = go.gameId 
       WHERE go.ownerId = ?`, [userId]);
    }
    async searchGames(query) {
        const searchTerm = `%${query.toLowerCase()}%`;
        return await this.databaseService.read(`SELECT gameId, name, description, price, owner_id, showInStore, 
              iconHash, splashHash, bannerHash, genre, release_date, 
              developer, publisher, platforms, rating, website, 
              trailer_link, multiplayer
       FROM games 
       WHERE showInStore = 1 
       AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(genre) LIKE ?) LIMIT 100`, [searchTerm, searchTerm, searchTerm]);
    }
    async createGame(game) {
        await this.databaseService.request(`INSERT INTO games (
                gameId, name, description, price, owner_id, showInStore, download_link,
                iconHash, splashHash, bannerHash, genre, release_date, developer,
                publisher, platforms, rating, website, trailer_link, multiplayer
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            game.gameId,
            game.name,
            game.description,
            game.price,
            game.owner_id,
            game.showInStore ? 1 : 0,
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
            game.multiplayer ? 1 : 0,
        ]);
    }
    async updateGame(gameId, fields, values) {
        values.push(gameId);
        await this.databaseService.request(`UPDATE games SET ${fields.join(", ")} WHERE gameId = ?`, values);
    }
    async deleteGame(gameId) {
        await this.databaseService.request("DELETE FROM games WHERE gameId = ?", [gameId]);
        await this.databaseService.request("DELETE FROM game_owners WHERE gameId = ?", [gameId]);
    }
    async addOwner(gameId, ownerId) {
        await this.databaseService.request("INSERT INTO game_owners (gameId, ownerId) VALUES (?, ?)", [gameId, ownerId]);
    }
    async removeOwner(gameId, ownerId) {
        await this.databaseService.request("DELETE FROM game_owners WHERE gameId = ? AND ownerId = ?", [gameId, ownerId]);
    }
}
exports.GameRepository = GameRepository;
