import { Game } from '../interfaces/Game';
import { IDatabaseService } from '../services/DatabaseService';

export class GameRepository {
  constructor(private databaseService: IDatabaseService) {}

  async getGames(filters: { gameId?: string; ownerId?: string; showInStore?: boolean; search?: string } = {}, select: string = '*', orderBy: string = '', limit?: number): Promise<Game[]> {
    // let query = `SELECT ${select} FROM games WHERE 1=1`;
    // const params = [];

    // if (filters.gameId) {
    //   query += ` AND gameId = ?`;
    //   params.push(filters.gameId);
    // }
    // if (filters.ownerId) {
    //   query += ` AND owner_id = ?`;
    //   params.push(filters.ownerId);
    // }
    // if (filters.showInStore !== undefined) {
    //   query += ` AND showInStore = ?`;
    //   params.push(filters.showInStore ? 1 : 0);
    // }
    // if (filters.search) {
    //   const searchTerm = `%${filters.search.toLowerCase()}%`;
    //   query += ` AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(genre) LIKE ?)`;
    //   params.push(searchTerm, searchTerm, searchTerm);
    // }
    // if (orderBy) query += ` ORDER BY ${orderBy}`;
    // if (limit) query += ` LIMIT ${limit}`;

    // return await this.databaseService.read<Game>(query, params);
    // MongoDB query to get games with filters
    const db = await this.databaseService.getDb();
    const mongoQuery: any = {};
    if (filters.gameId) {
      mongoQuery.gameId = filters.gameId;
    }
    if (filters.ownerId) {
      mongoQuery.owner_id = filters.ownerId;
    }
    if (filters.showInStore !== undefined) {
      mongoQuery.showInStore = filters.showInStore;
    }
    if (filters.search) {
      const searchTerm = new RegExp(filters.search, 'i');
      mongoQuery.$or = [
        { name: searchTerm },
        { description: searchTerm },
        { genre: searchTerm }
      ];
    }
    
    const result = await db.collection('games').find(mongoQuery).toArray();

    // Convert MongoDB documents to Game interface if necessary
    const games: Game[] = result.map(doc => ({
      id: doc.id,
      gameId: doc.gameId,
      name: doc.name,
      description: doc.description,
      price: doc.price,
      owner_id: doc.owner_id,
      showInStore: Boolean(doc.showInStore),
      iconHash: doc.iconHash || null,
      splashHash: doc.splashHash || null,
      bannerHash: doc.bannerHash || null,
      genre: doc.genre || null,
      release_date: doc.release_date || null,
      developer: doc.developer || null,
      publisher: doc.publisher || null,
      platforms: doc.platforms || [],
      rating: doc.rating || 0,
      website: doc.website || null,
      trailer_link: doc.trailer_link || null,
      multiplayer: Boolean(doc.multiplayer)
    }));
    return games;
  }

  async getGame(gameId: string): Promise<Game | null> {
    const games = await this.getGames({ gameId });
    return games[0] || null;
  }

  async getGameForPublic(gameId: string): Promise<Game | null> {
    const select = `gameId, name, description, price, owner_id, showInStore, 
      iconHash, splashHash, bannerHash, genre, release_date, 
      developer, publisher, platforms, rating, website, 
      trailer_link, multiplayer`;
    const games = await this.getGames({ gameId }, select);
    return games[0] || null;
  }

  async getGameForOwner(gameId: string, userId: string): Promise<Game | null> {
    // const rows = await this.databaseService.read<Game>(
    //   `SELECT g.*,
    //           CASE 
    //             WHEN g.owner_id = ? OR go.ownerId IS NOT NULL 
    //             THEN 1 ELSE 0 
    //           END as can_download
    //    FROM games g 
    //    LEFT JOIN game_owners go ON g.gameId = go.gameId AND go.ownerId = ?
    //    WHERE g.gameId = ?`,
    //   [userId, userId, gameId]
    // );
    // return rows.length > 0 ? rows[0] : null;
    // MongoDB query to get game for owner
    const db = await this.databaseService.getDb();
    const result = await db.collection('games').aggregate([
      { $match: { gameId: gameId } },
      { $lookup: {
          from: 'game_owners',
          let: { gameId: '$gameId' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$gameId', '$$gameId'] },
              { $eq: ['$ownerId', userId] }
            ] } } }
          ],
          as: 'owners'
        }
      },
      { $addFields: {
          can_download: {
            $cond: {
              if: { $or: [
                { $eq: ['$owner_id', userId] },
                { $gt: [{ $size: '$owners' }, 0] }
              ] },
              then: true,
              else: false
            }
          }
        }
      },
      { $project: {
          gameId: 1,
          name: 1,
          description: 1,
          price: 1,
          owner_id: 1,
          showInStore: 1,
          iconHash: 1,
          splashHash: 1,
          bannerHash: 1,
          genre: 1,
          release_date: 1,
          developer: 1,
          publisher: 1,
          platforms: 1,
          rating: 1,
          website: 1,
          trailer_link: 1,
          multiplayer: 1,
          can_download: 1
        }
      }
    ]).toArray();
    const games: Game = result.map(doc => ({
      id: doc._id.toString(),
      gameId: doc.gameId,
      name: doc.name,
      description: doc.description,
      price: doc.price,
      owner_id: doc.owner_id,
      showInStore: Boolean(doc.showInStore),
      iconHash: doc.iconHash || null,
      splashHash: doc.splashHash || null,
      bannerHash: doc.bannerHash || null,
      genre: doc.genre || null,
      release_date: doc.release_date || null,
      developer: doc.developer || null,
      publisher: doc.publisher || null,
      platforms: doc.platforms || [],
      rating: doc.rating || 0,
      website: doc.website || null,
      trailer_link: doc.trailer_link || null,
      multiplayer: Boolean(doc.multiplayer),
      can_download : Boolean(doc.can_download)
    }))[0] || null;
    return games;
  }

  async getUserGames(userId: string): Promise<Game[]> {
    // return await this.databaseService.read<Game>(
    //   `SELECT g.* 
    //    FROM games g 
    //    INNER JOIN game_owners go ON g.gameId = go.gameId 
    //    WHERE go.ownerId = ?`,
    //   [userId]
    // );
    // MongoDB query to get user games
    const db = await this.databaseService.getDb();
    const result = await db.collection('games').aggregate([
      { $lookup: {
          from: 'game_owners',
          localField: 'gameId',
          foreignField: 'gameId',
          as: 'owners'
        }
      },
      { $match: { 'owners.ownerId': userId } }
    ]).toArray();
    const games: Game[] = result.map(doc => ({
      id: doc._id.toString(),
      gameId: doc.gameId,
      name: doc.name,
      description: doc.description,
      price: doc.price,
      owner_id: doc.owner_id,
      showInStore: Boolean(doc.showInStore),
      iconHash: doc.iconHash || null,
      splashHash: doc.splashHash || null,
      bannerHash: doc.bannerHash || null,
      genre: doc.genre || null,
      release_date: doc.release_date || null,
      developer: doc.developer || null,
      publisher: doc.publisher || null,
      platforms: doc.platforms || [],
      rating: doc.rating || 0,
      website: doc.website || null,
      trailer_link: doc.trailer_link || null,
      multiplayer: Boolean(doc.multiplayer)
    }));
    return games;
  }

  async listGames(): Promise<Game[]> {
    return await this.getGames();
  }

  async getStoreGames(): Promise<Game[]> {
    const select = `gameId, name, description, price, owner_id, showInStore, 
      iconHash, splashHash, bannerHash, genre, release_date, 
      developer, publisher, platforms, rating, website, 
      trailer_link, multiplayer`;
    return await this.getGames({ showInStore: true }, select);
  }

  async getMyCreatedGames(userId: string): Promise<Game[]> {
    return await this.getGames({ ownerId: userId });
  }

  async getUserOwnedGames(userId: string): Promise<Game[]> {
    // return await this.databaseService.read<Game>(
    //   `SELECT g.* 
    //    FROM games g 
    //    INNER JOIN game_owners go ON g.gameId = go.gameId 
    //    WHERE go.ownerId = ?`,
    //   [userId]
    // );
    // MongoDB query to get user owned games
    const db = await this.databaseService.getDb();
    const result = await db.collection('games').aggregate([
      { $lookup: {
          from: 'game_owners',
          localField: 'gameId',
          foreignField: 'gameId',
          as: 'owners'
        }
      },
      { $match: { 'owners.ownerId': userId } }
    ]).toArray();
    const games: Game[] = result.map(doc => ({
      id: doc._id.toString(),
      gameId: doc.gameId,
      name: doc.name,
      description: doc.description,
      price: doc.price,
      owner_id: doc.owner_id,
      showInStore: Boolean(doc.showInStore),
      iconHash: doc.iconHash || null,
      splashHash: doc.splashHash || null,
      bannerHash: doc.bannerHash || null,
      genre: doc.genre || null,
      release_date: doc.release_date || null,
      developer: doc.developer || null,
      publisher: doc.publisher || null,
      platforms: doc.platforms || [],
      rating: doc.rating || 0,
      website: doc.website || null,
      trailer_link: doc.trailer_link || null,
      multiplayer: Boolean(doc.multiplayer)
    }));
    return games;
  }

  async searchGames(query: string): Promise<Game[]> {
    const select = `gameId, name, description, price, owner_id, showInStore, 
      iconHash, splashHash, bannerHash, genre, release_date, 
      developer, publisher, platforms, rating, website, 
      trailer_link, multiplayer`;
    return await this.getGames({ showInStore: true, search: query }, select, '', 100);
  }

  async createGame(game: Omit<Game, 'id'>): Promise<void> {
    // await this.databaseService.request(
    //   `INSERT INTO games (
    //             gameId, name, description, price, owner_id, showInStore, download_link,
    //             iconHash, splashHash, bannerHash, genre, release_date, developer,
    //             publisher, platforms, rating, website, trailer_link, multiplayer
    //         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    //   [game.gameId, game.name, game.description, game.price, game.owner_id, game.showInStore ? 1 : 0, game.download_link, game.iconHash ?? null, game.splashHash ?? null, game.bannerHash ?? null, game.genre ?? null, game.release_date ?? null, game.developer ?? null, game.publisher ?? null, game.platforms ?? null, game.rating ?? 0, game.website ?? null, game.trailer_link ?? null, game.multiplayer ? 1 : 0]
    // );
    // MongoDB query to create a game
    const db = await this.databaseService.getDb();
    await db.collection('games').insertOne({
      gameId: game.gameId,
      name: game.name,
      description: game.description,
      price: game.price,
      owner_id: game.owner_id,
      showInStore: game.showInStore,
      download_link: game.download_link || null,
      iconHash: game.iconHash || null,
      splashHash: game.splashHash || null,
      bannerHash: game.bannerHash || null,
      genre: game.genre || null,
      release_date: game.release_date ? new Date(game.release_date) : null,
      developer: game.developer || null,
      publisher: game.publisher || null,
      platforms: game.platforms || null,
      rating: game.rating || 0,
      website: game.website || null,
      trailer_link: game.trailer_link || null,
      multiplayer: game.multiplayer
    });
  }

  async updateGame(gameId: string, fields: string[], values: unknown[]): Promise<void> {
    values.push(gameId);
    // await this.databaseService.request(`UPDATE games SET ${fields.join(', ')} WHERE gameId = ?`, values);
    // MongoDB query to update a game
    const db = await this.databaseService.getDb();
    const updateFields: any = {};
    fields.forEach((field, index) => {
      updateFields[field] = values[index];
    });
    await db.collection('games').updateOne({ gameId: gameId }, { $set: updateFields });
  }

  async deleteGame(gameId: string): Promise<void> {
    // await this.databaseService.request('DELETE FROM games WHERE gameId = ?', [gameId]);
    // await this.databaseService.request('DELETE FROM game_owners WHERE gameId = ?', [gameId]);
    // MongoDB query to delete a game and its owners
    const db = await this.databaseService.getDb();
    await db.collection('games').deleteOne({ gameId: gameId });
    await db.collection('game_owners').deleteMany({ gameId: gameId });
  }

  async addOwner(gameId: string, ownerId: string): Promise<void> {
    // await this.databaseService.request('INSERT INTO game_owners (gameId, ownerId) VALUES (?, ?)', [gameId, ownerId]);
    // MongoDB query to add an owner to a game
    const db = await this.databaseService.getDb();
    await db.collection('game_owners').insertOne({ gameId: gameId, ownerId: ownerId });
  }

  async removeOwner(gameId: string, ownerId: string): Promise<void> {
    // await this.databaseService.request('DELETE FROM game_owners WHERE gameId = ? AND ownerId = ?', [gameId, ownerId]);
    // MongoDB query to remove an owner from a game
    const db = await this.databaseService.getDb();
    await db.collection('game_owners').deleteOne({ gameId: gameId, ownerId: ownerId });
  }
}
