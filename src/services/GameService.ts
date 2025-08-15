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
    return await this.gameRepository.getGame(gameId);
  }

  /**
   * Get game with public fields only (no download_link)
   */
  async getGameForPublic(gameId: string): Promise<Game | null> {
    return await this.gameRepository.getGameForPublic(gameId);
  }

  /**
   * Get game with download_link if user owns it or is the creator
   */
  async getGameForOwner(gameId: string, userId: string): Promise<Game | null> {
    const game = await this.gameRepository.getGameForOwner(gameId, userId);
    if (!game) return null;
    game.download_link = `/api/games/${gameId}/download`;
    return game;
  }

  async getUserGames(userId: string): Promise<Game[]> {
    const games = await this.gameRepository.getUserGames(userId);
    return games.map(game => ({
      ...game,
      download_link: `/api/games/${game.gameId}/download`
    }));
  }

  async listGames(): Promise<Game[]> {
    return await this.gameRepository.listGames();
  }

  async getStoreGames(): Promise<Game[]> {
    return await this.gameRepository.getStoreGames();
  }

  async getMyCreatedGames(userId: string): Promise<Game[]> {
    return await this.gameRepository.getMyCreatedGames(userId);
  }

  async getUserOwnedGames(userId: string): Promise<Game[]> {
    const games = await this.gameRepository.getUserOwnedGames(userId);
    return games.map(game => ({
      ...game,
      download_link: `/api/games/${game.gameId}/download`
    }));
  }

  async searchGames(query: string): Promise<Game[]> {
    return await this.gameRepository.searchGames(query);
  }

  async createGame(game: Omit<Game, "id">): Promise<void> {
    await this.gameRepository.createGame(game);
  }

  async updateGame(
    gameId: string,
    game: Partial<Omit<Game, "id" | "gameId">>
  ): Promise<void> {
    const { fields, values } = buildUpdateFields(game, ["owners"]);
    if (!fields.length) return;
    await this.gameRepository.updateGame(gameId, fields, values);
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

  async transferOwnership(
    gameId: string,
    newOwnerId: string
  ): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");
    await this.updateGame(gameId, { owner_id: newOwnerId });
  }

  async canUserGiftGame(): Promise<boolean> {
    // Pour créer un gift, l'utilisateur doit juste avoir assez de crédits
    // Il n'a pas besoin de posséder le jeu
    return true;
  }

  async userOwnsGame(gameId: string, userId: string): Promise<boolean> {
    const userGames = await this.getUserGames(userId);
    return userGames.some(game => game.gameId === gameId);
  }

  async transferGameCopy(gameId: string, fromUserId: string, toUserId: string): Promise<void> {
    // Vérifier que l'expéditeur possède le jeu
    const fromUserOwns = await this.userOwnsGame(gameId, fromUserId);
    if (!fromUserOwns) {
      throw new Error("You don't own this game");
    }

    // Vérifier que le destinataire ne possède pas déjà le jeu
    const toUserOwns = await this.userOwnsGame(gameId, toUserId);
    if (toUserOwns) {
      throw new Error("Recipient already owns this game");
    }

    // Vérifier que l'expéditeur n'est pas le créateur du jeu
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    
    if (game.owner_id === fromUserId) {
      throw new Error("Game creator cannot transfer their copy");
    }

    // Effectuer le transfert
    await this.removeOwner(gameId, fromUserId);
    await this.addOwner(gameId, toUserId);
  }

  async canTransferGame(gameId: string, fromUserId: string, toUserId: string): Promise<{ canTransfer: boolean; reason?: string }> {
    // Vérifier que l'expéditeur possède le jeu
    const fromUserOwns = await this.userOwnsGame(gameId, fromUserId);
    if (!fromUserOwns) {
      return { canTransfer: false, reason: "You don't own this game" };
    }

    // Vérifier que le destinataire ne possède pas déjà le jeu
    const toUserOwns = await this.userOwnsGame(gameId, toUserId);
    if (toUserOwns) {
      return { canTransfer: false, reason: "Recipient already owns this game" };
    }

    // Vérifier que l'expéditeur n'est pas le créateur du jeu
    const game = await this.getGame(gameId);
    if (!game) {
      return { canTransfer: false, reason: "Game not found" };
    }
    
    if (game.owner_id === fromUserId) {
      return { canTransfer: false, reason: "Game creator cannot transfer their copy" };
    }

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
