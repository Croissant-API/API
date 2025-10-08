import { inject, injectable } from "inversify";
import { Badge } from "../interfaces/Badge";
import { Game } from "../interfaces/Game";
import { GameViewStats } from "../interfaces/GameView";
import { GameRepository } from "../repositories/GameRepository";
import { BadgeService } from "./BadgeService";
import { IDatabaseService } from "./DatabaseService";
import { GameViewService } from "./GameViewService";

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
  getGameWithBadgesAndViews(gameId: string): Promise<(Game & { badges: Badge[]; views: GameViewStats }) | null>;
  getGamesWithBadgesAndViews(gameIds: string[]): Promise<(Game & { badges: Badge[]; views: GameViewStats })[]>;
}

@injectable()
export class GameService implements IGameService {
  private gameRepository: GameRepository;
  private badgeService: BadgeService;
  private gameViewService: GameViewService;

  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {
    this.gameRepository = new GameRepository(this.databaseService);
    this.badgeService = new BadgeService(this.databaseService);
    this.gameViewService = new GameViewService(this.databaseService);
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
    // Ajouter le badge "nouveau" pour 10 jours
    try {
      await this.badgeService.addBadgeToGame(game.gameId, "nouveau");
    } catch (error) {
      console.error("Error adding 'nouveau' badge to game:", error);
    }
  }

  async updateGame(gameId: string, game: Partial<Omit<Game, "id" | "gameId">>): Promise<void> {
    const { fields, values } = buildUpdateFields(game, ["owners", "markAsUpdated"]);
    if (fields.length) await this.gameRepository.updateGame(gameId, fields, values);
    
    // Si markAsUpdated est true, ajouter le badge "mise-a-jour"
    if (game.markAsUpdated) {
      try {
        await this.badgeService.addBadgeToGame(gameId, "mise-a-jour");
      } catch (error) {
        console.error("Error adding 'mise-a-jour' badge to game:", error);
      }
    }
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

  async getGameWithBadgesAndViews(gameId: string): Promise<(Game & { badges: Badge[]; views: GameViewStats }) | null> {
    const game = await this.getGame(gameId);
    if (!game) return null;

    const [badges, views] = await Promise.all([
      this.badgeService.getActiveBadgesForGame(gameId),
      this.gameViewService.getGameViewStats(gameId)
    ]);

    return {
      ...game,
      badges,
      views
    };
  }

  async getGamesWithBadgesAndViews(gameIds: string[]): Promise<(Game & { badges: Badge[]; views: GameViewStats })[]> {
    if (gameIds.length === 0) return [];

    const [games, viewsMap] = await Promise.all([
      Promise.all(gameIds.map(id => this.getGame(id))),
      this.gameViewService.getViewsForGames(gameIds)
    ]);

    const results: (Game & { badges: Badge[]; views: GameViewStats })[] = [];

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      if (game) {
        const badges = await this.badgeService.getActiveBadgesForGame(game.gameId);
        const views = viewsMap[game.gameId] || {
          gameId: game.gameId,
          total_views: 0,
          unique_views: 0,
          views_today: 0,
          views_this_week: 0,
          views_this_month: 0
        };

        results.push({
          ...game,
          badges,
          views
        });
      }
    }

    return results;
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
