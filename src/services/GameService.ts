import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Game } from "../interfaces/Game";

export interface IGameService {
  getUserGames(userId: string): Promise<Game[]>;
  getGame(gameId: string): Promise<Game | null>;
  listGames(): Promise<Game[]>;
  getStoreGames(): Promise<Game[]>;
  getMyCreatedGames(userId: string): Promise<Game[]>;
  getUserOwnedGames(userId: string): Promise<Game[]>;
  createGame(game: Omit<Game, "id">): Promise<void>;
  updateGame(
    gameId: string,
    game: Partial<Omit<Game, "id" | "gameId">>
  ): Promise<void>;
  deleteGame(gameId: string): Promise<void>;
  addOwner(gameId: string, ownerId: string): Promise<void>;
  removeOwner(gameId: string, ownerId: string): Promise<void>;
  transferOwnership(gameId: string, newOwnerId: string): Promise<void>;
  searchGames(query: string): Promise<Game[]>;
  getGameForPublic(gameId: string): Promise<Game | null>;
  getGameForOwner(gameId: string, userId: string): Promise<Game | null>;
}

@injectable()
export class GameService implements IGameService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) { }

  async getGame(gameId: string): Promise<Game | null> {
    const rows = await this.databaseService.read<Game[]>(
      "SELECT * FROM games WHERE gameId = ?",
      [gameId]
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  /**
   * Get game with public fields only (no download_link)
   */
  async getGameForPublic(gameId: string): Promise<Game | null> {
    const rows = await this.databaseService.read<Game[]>(
      `SELECT gameId, name, description, price, owner_id, showInStore, 
              iconHash, splashHash, bannerHash, genre, release_date, 
              developer, publisher, platforms, rating, website, 
              trailer_link, multiplayer
       FROM games 
       WHERE gameId = ?`,
      [gameId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get game with download_link if user owns it or is the creator
   */
  async getGameForOwner(gameId: string, userId: string): Promise<Game | null> {
    const rows = await this.databaseService.read<Game[]>(
      `SELECT g.*,
              CASE 
                WHEN g.owner_id = ? OR go.ownerId IS NOT NULL 
                THEN g.download_link 
                ELSE NULL 
              END as download_link
       FROM games g 
       LEFT JOIN game_owners go ON g.gameId = go.gameId AND go.ownerId = ?
       WHERE g.gameId = ?`,
      [userId, userId, gameId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async getUserGames(userId: string): Promise<Game[]> {
    const games = await this.databaseService.read<Game[]>(
      `SELECT g.*, 
              CASE WHEN go.ownerId IS NOT NULL THEN g.download_link ELSE NULL END as download_link
       FROM games g 
       INNER JOIN game_owners go ON g.gameId = go.gameId 
       WHERE go.ownerId = ?`,
      [userId]
    );
    return games;
  }

  async listGames(): Promise<Game[]> {
    const games = await this.databaseService.read<Game[]>(
      "SELECT * FROM games"
    );
    return games;
  }

  async getStoreGames(): Promise<Game[]> {
    const games = await this.databaseService.read<Game[]>(
      `SELECT gameId, name, description, price, owner_id, showInStore, 
              iconHash, splashHash, bannerHash, genre, release_date, 
              developer, publisher, platforms, rating, website, 
              trailer_link, multiplayer
       FROM games 
       WHERE showInStore = 1`
    );
    return games;
  }

  async getMyCreatedGames(userId: string): Promise<Game[]> {
    const games = await this.databaseService.read<Game[]>(
      `SELECT g.*, g.download_link
       FROM games g 
       WHERE g.owner_id = ?`,
      [userId]
    );
    return games;
  }

  async getUserOwnedGames(userId: string): Promise<Game[]> {
    const games = await this.databaseService.read<Game[]>(
      `SELECT g.*, g.download_link
       FROM games g 
       INNER JOIN game_owners go ON g.gameId = go.gameId 
       WHERE go.ownerId = ?`,
      [userId]
    );
    return games;
  }

  async searchGames(query: string): Promise<Game[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    const games = await this.databaseService.read<Game[]>(
      `SELECT gameId, name, description, price, owner_id, showInStore, 
              iconHash, splashHash, bannerHash, genre, release_date, 
              developer, publisher, platforms, rating, website, 
              trailer_link, multiplayer
       FROM games 
       WHERE showInStore = 1 
       AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(genre) LIKE ?)`,
      [searchTerm, searchTerm, searchTerm]
    );
    return games;
  }

  async createGame(game: Omit<Game, "id">): Promise<void> {
    await this.databaseService.update(
      `INSERT INTO games (
                gameId, name, description, price, owner_id, showInStore, download_link,
                iconHash, splashHash, bannerHash, genre, release_date, developer,
                publisher, platforms, rating, website, trailer_link, multiplayer
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    );
  }

  async updateGame(
    gameId: string,
    game: Partial<Omit<Game, "id" | "gameId">>
  ): Promise<void> {
    const { fields, values } = buildUpdateFields(game, ["owners"]);
    if (!fields.length) return;
    values.push(gameId);
    await this.databaseService.update(
      `UPDATE games SET ${fields.join(", ")} WHERE gameId = ?`,
      values
    );
  }

  async deleteGame(gameId: string): Promise<void> {
    await this.databaseService.update("DELETE FROM games WHERE gameId = ?", [gameId]);
    await this.databaseService.update("DELETE FROM game_owners WHERE gameId = ?", [gameId]);
  }

  async addOwner(gameId: string, ownerId: string): Promise<void> {
    await this.databaseService.update(
      "INSERT INTO game_owners (gameId, ownerId) VALUES (?, ?)",
      [gameId, ownerId]
    );
  }

  async removeOwner(gameId: string, ownerId: string): Promise<void> {
    await this.databaseService.update(
      "DELETE FROM game_owners WHERE gameId = ? AND ownerId = ?",
      [gameId, ownerId]
    );
  }

  async transferOwnership(
    gameId: string,
    newOwnerId: string
  ): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");
    await this.updateGame(gameId, { owner_id: newOwnerId });
  }
}

function toDbBool(val: unknown) {
  return val ? 1 : 0;
}

function buildUpdateFields(obj: Record<string, unknown>, skip: string[] = []) {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key in obj) {
    if (skip.includes(key)) continue;
    fields.push(`${key} = ?`);
    values.push(
      ["showInStore", "multiplayer"].includes(key)
        ? toDbBool(obj[key])
        : obj[key]
    );
  }
  return { fields, values };
}
