export class GameRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    games() {
        return this.databaseService.from('games');
    }
    async getGames(filters = {}, select = '*', orderBy = '', limit) {
        let query = this.games().select(select);
        if (filters.gameId) {
            query = query.eq('gameId', filters.gameId);
        }
        if (filters.ownerId) {
            query = query.eq('owner_id', filters.ownerId);
        }
        if (filters.showInStore !== undefined) {
            query = query.eq('showInStore', filters.showInStore ? 1 : 0);
        }
        if (filters.search) {
            const term = `%${filters.search.toLowerCase()}%`;
            query = query.ilike('name', term).or(`description.ilike.${term},genre.ilike.${term}`);
        }
        if (orderBy) {
            query = query.order(orderBy);
        }
        if (limit) {
            query = query.limit(limit);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        return data || [];
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
        // use an inner join against the game_owners relation to decide whether the
        // user can download; we fetch the flag in the client rather than through
        // a custom RPC.
        const { data, error } = await this.games()
            .select('*, game_owners!inner(ownerId)')
            .eq('gameId', gameId)
            .eq('game_owners.ownerId', userId)
            .limit(1);
        if (error)
            throw error;
        if (!data || data.length === 0)
            return null;
        const row = data[0];
        return {
            ...row,
            can_download: row.game_owners && row.game_owners.length ? 1 : row.owner_id === userId ? 1 : 0,
        };
    }
    async getUserGames(userId) {
        const { data, error } = await this.games()
            .select('*, game_owners!inner(ownerId)')
            .eq('game_owners.ownerId', userId);
        if (error)
            throw error;
        return data || [];
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
        const { data, error } = await this.games()
            .select('*, game_owners!inner(ownerId)')
            .eq('game_owners.ownerId', userId);
        if (error)
            throw error;
        return data || [];
    }
    async searchGames(query) {
        const select = `gameId, name, description, price, owner_id, showInStore, 
      iconHash, splashHash, bannerHash, genre, release_date, 
      developer, publisher, platforms, rating, website, 
      trailer_link, multiplayer`;
        return await this.getGames({ showInStore: true, search: query }, select, '', 100);
    }
    async createGame(game) {
        const row = {
            ...game,
            showInStore: game.showInStore ? 1 : 0,
            rating: game.rating ?? 0,
            multiplayer: game.multiplayer ? 1 : 0,
        };
        const { error } = await this.games().insert(row);
        if (error)
            throw error;
    }
    async updateGame(gameId, fields, values) {
        const obj = {};
        fields.forEach((f, i) => {
            // field strings were like "foo = ?"; extract key
            const key = f.split('=')[0].trim();
            obj[key] = values[i];
        });
        const { error } = await this.games().update(obj).eq('gameId', gameId);
        if (error)
            throw error;
    }
    async deleteGame(gameId) {
        await this.databaseService.request('DELETE FROM games WHERE gameId = ?', [gameId]);
        await this.databaseService.request('DELETE FROM game_owners WHERE gameId = ?', [gameId]);
    }
    async addOwner(gameId, ownerId) {
        await this.databaseService.request('INSERT INTO game_owners (gameId, ownerId) VALUES (?, ?)', [gameId, ownerId]);
    }
    async removeOwner(gameId, ownerId) {
        await this.databaseService.request('DELETE FROM game_owners WHERE gameId = ? AND ownerId = ?', [gameId, ownerId]);
    }
}
