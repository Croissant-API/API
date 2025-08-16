import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { GameRepository } from "../repositories/GameRepository";
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
  canUserGiftGame(): Promise<boolean>;
  userOwnsGame(gameId: string, userId: string): Promise<boolean>;
  transferGameCopy(gameId: string, fromUserId: string, toUserId: string): Promise<void>;
  canTransferGame(gameId: string, fromUserId: string, toUserId: string): Promise<{ canTransfer: boolean; reason?: string }>;
}

@injectable()
export class GameService implements IGameService {
  private gameRepository: GameRepository;
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {
    this.gameRepository = new GameRepository(this.databaseService);
  }

  async getGame(gameId: string): Promise<Game | null> {
    return this.gameRepository.getGame(gameId);
  }

  async getGameForPublic(gameId: string): Promise<Game | null> {
    return this.gameRepository.getGameForPublic(gameId);
  }

  async getGameForOwner(gameId: string, userId: string): Promise<Game | null> {
    const game = await this.gameRepository.getGameForOwner(gameId, userId);
    return game ? { ...game, download_link: `/api/games/${gameId}/download` } : null;
  }

  async getUserGames(userId: string): Promise<Game[]> {
    const games = await this.gameRepository.getUserGames(userId);
    return games.map(game => ({ ...game, download_link: `/api/games/${game.gameId}/download` }));
  }

  async listGames(): Promise<Game[]> {
    return this.gameRepository.listGames();
  }

  async getStoreGames(): Promise<Game[]> {
    return this.gameRepository.getStoreGames();
  }

  async getMyCreatedGames(userId: string): Promise<Game[]> {
    return this.gameRepository.getMyCreatedGames(userId);
  }

  async getUserOwnedGames(userId: string): Promise<Game[]> {
    const games = await this.gameRepository.getUserOwnedGames(userId);
    return games.map(game => ({ ...game, download_link: `/api/games/${game.gameId}/download` }));
  }

  async searchGames(query: string): Promise<Game[]> {
    return this.gameRepository.searchGames(query);
  }

  async createGame(game: Omit<Game, "id">): Promise<void> {
    await this.gameRepository.createGame(game);
  }

  async updateGame(gameId: string, game: Partial<Omit<Game, "id" | "gameId">>): Promise<void> {
    const { fields, values } = buildUpdateFields(game, ["owners"]);
    if (fields.length) await this.gameRepository.updateGame(gameId, fields, values);
  }

  async deleteGame(gameId: string): Promise<void> {
    await this.gameRepository.deleteGame(gameId);
  }

  async addOwner(gameId: string, ownerId: string): Promise<void> {
    await this.gameRepository.addOwner(gameId, ownerId);
  }

  async removeOwner(gameId: string, ownerId: string): Promise<void> {
    await this.gameRepository.removeOwner(gameId, ownerId);
  }

  async transferOwnership(gameId: string, newOwnerId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");
    await this.updateGame(gameId, { owner_id: newOwnerId });
  }

  async canUserGiftGame(): Promise<boolean> {
    return true;
  }

  async userOwnsGame(gameId: string, userId: string): Promise<boolean> {
    const games = await this.getUserGames(userId);
    return games.some(game => game.gameId === gameId);
  }

  async transferGameCopy(gameId: string, fromUserId: string, toUserId: string): Promise<void> {
    const [fromOwns, toOwns, game] = await Promise.all([
      this.userOwnsGame(gameId, fromUserId),
      this.userOwnsGame(gameId, toUserId),
      this.getGame(gameId)
    ]);
    if (!fromOwns) throw new Error("You don't own this game");
    if (toOwns) throw new Error("Recipient already owns this game");
    if (!game) throw new Error("Game not found");
    if (game.owner_id === fromUserId) throw new Error("Game creator cannot transfer their copy");
    await this.removeOwner(gameId, fromUserId);
    await this.addOwner(gameId, toUserId);
  }

  async canTransferGame(gameId: string, fromUserId: string, toUserId: string): Promise<{ canTransfer: boolean; reason?: string }> {
    const [fromOwns, toOwns, game] = await Promise.all([
      this.userOwnsGame(gameId, fromUserId),
      this.userOwnsGame(gameId, toUserId),
      this.getGame(gameId)
    ]);
    if (!fromOwns) return { canTransfer: false, reason: "You don't own this game" };
    if (toOwns) return { canTransfer: false, reason: "Recipient already owns this game" };
    if (!game) return { canTransfer: false, reason: "Game not found" };
    if (game.owner_id === fromUserId) return { canTransfer: false, reason: "Game creator cannot transfer their copy" };
    return { canTransfer: true };
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
