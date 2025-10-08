"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRepository = void 0;
class GameRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    
    async getGames(filters = {}, select = "*", orderBy = "", limit) {
        let query = `SELECT ${select} FROM games WHERE 1=1`;
        const params = [];
        if (filters.gameId) {
            query += ` AND gameId = ?`;
            params.push(filters.gameId);
        }
        if (filters.ownerId) {
            query += ` AND owner_id = ?`;
            params.push(filters.ownerId);
        }
        if (filters.showInStore !== undefined) {
            query += ` AND showInStore = ?`;
            params.push(filters.showInStore ? 1 : 0);
        }
        if (filters.search) {
            const searchTerm = `%${filters.search.toLowerCase()}%`;
            query += ` AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(genre) LIKE ?)`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        if (orderBy)
            query += ` ORDER BY ${orderBy}`;
        if (limit)
            query += ` LIMIT ${limit}`;
        return await this.databaseService.read(query, params);
    }
    
    async getGame(gameId) {
        const games = await this.getGames({ gameId });
        return games[0] || null;
    }
    async getGameForPublic(gameId) {
        const select = `gameId, name, description, price, owner_id, showInStore, 
      iconHash, splashHash, bannerHash, genre, release_date, 
      developer, publisher, platforms, rating, website, 
      trailer_link, multiplayer`;
        const games = await this.getGames({ gameId }, select);
        return games[0] || null;
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
        return await this.getGames();
    }
    async getStoreGames() {
        const select = `gameId, name, description, price, owner_id, showInStore, 
      iconHash, splashHash, bannerHash, genre, release_date, 
      developer, publisher, platforms, rating, website, 
      trailer_link, multiplayer`;
        return await this.getGames({ showInStore: true }, select);
    }
    async getMyCreatedGames(userId) {
        return await this.getGames({ ownerId: userId });
    }
    async getUserOwnedGames(userId) {
        return await this.databaseService.read(`SELECT g.* 
       FROM games g 
       INNER JOIN game_owners go ON g.gameId = go.gameId 
       WHERE go.ownerId = ?`, [userId]);
    }
    async searchGames(query) {
        const select = `gameId, name, description, price, owner_id, showInStore, 
      iconHash, splashHash, bannerHash, genre, release_date, 
      developer, publisher, platforms, rating, website, 
      trailer_link, multiplayer`;
        return await this.getGames({ showInStore: true, search: query }, select, "", 100);
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

