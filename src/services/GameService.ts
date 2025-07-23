import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Game } from "../interfaces/Game";

export interface IGameService {
  getUserGames(userId: string): Promise<Game[]>;
  getGame(gameId: string): Promise<Game | null>;
  listGames(): Promise<Game[]>;
  createGame(game: Omit<Game, "id">): Promise<void>;
  updateGame(
    gameId: string,
    game: Partial<Omit<Game, "id" | "gameId">>
  ): Promise<void>;
  deleteGame(gameId: string): Promise<void>;
  addOwner(gameId: string, ownerId: string): Promise<void>;
  removeOwner(gameId: string, ownerId: string): Promise<void>;
}

@injectable()
export class GameService implements IGameService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {}

  async getGame(gameId: string): Promise<Game | null> {
    const rows = await this.databaseService.read<Game[]>(
      "SELECT * FROM games WHERE gameId = ?",
      [gameId]
    );
    if (rows.length === 0) return null;
    const game = rows[0];
    return { ...game };
  }

  async getUserGames(userId: string): Promise<Game[]> {
    const games = await this.listGames();
    const rows = await this.databaseService.read<Game[]>(
      "SELECT gameId FROM game_owners WHERE ownerId = ?",
      [userId]
    );
    const gameIds = rows.map((row: { gameId: string }) => row.gameId);
    const filteredGames = games.filter((game) => gameIds.includes(game.gameId));
    return filteredGames;
  }

  async listGames(): Promise<Game[]> {
    const games = await this.databaseService.read<Game[]>(
      "SELECT * FROM games"
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
