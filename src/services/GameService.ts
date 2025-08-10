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
  canUserGiftGame(): Promise<boolean>;
  userOwnsGame(gameId: string, userId: string): Promise<boolean>;
  transferGameCopy(gameId: string, fromUserId: string, toUserId: string): Promise<void>;
  canTransferGame(gameId: string, fromUserId: string, toUserId: string): Promise<{ canTransfer: boolean; reason?: string }>;
}

@injectable()
export class GameService implements IGameService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) { }

  async getGame(gameId: string): Promise<Game | null> {
    const rows = await this.databaseService.read<Game>(
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
    const rows = await this.databaseService.read<Game>(
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
    const rows = await this.databaseService.read<Game>(
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
    const games = await this.databaseService.read<Game>(
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
    const games = await this.databaseService.read<Game>(
      "SELECT * FROM games"
    );
    return games;
  }

  async getStoreGames(): Promise<Game[]> {
    const games = await this.databaseService.read<Game>(
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
    const games = await this.databaseService.read<Game>(
      `SELECT g.*, g.download_link
       FROM games g 
       WHERE g.owner_id = ?`,
      [userId]
    );
    return games;
  }

  async getUserOwnedGames(userId: string): Promise<Game[]> {
    const games = await this.databaseService.read<Game>(
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
    const games = await this.databaseService.read<Game>(
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
    await this.databaseService.request(
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
    await this.databaseService.request(
      `UPDATE games SET ${fields.join(", ")} WHERE gameId = ?`,
      values
    );
  }

  async deleteGame(gameId: string): Promise<void> {
    await this.databaseService.request("DELETE FROM games WHERE gameId = ?", [gameId]);
    await this.databaseService.request("DELETE FROM game_owners WHERE gameId = ?", [gameId]);
  }

  async addOwner(gameId: string, ownerId: string): Promise<void> {
    await this.databaseService.request(
      "INSERT INTO game_owners (gameId, ownerId) VALUES (?, ?)",
      [gameId, ownerId]
    );
  }

  async removeOwner(gameId: string, ownerId: string): Promise<void> {
    await this.databaseService.request(
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
