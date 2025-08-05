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
  private readonly tableName = 'games';
  private readonly gameOwnersTable = 'game_owners';

  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) { }

  async getGame(gameId: string): Promise<Game | null> {
    const knex = this.databaseService.getKnex();
    try {
      const game = await knex(this.tableName)
        .where({ gameId: gameId })
        .first();
      return game || null;
    } catch (error) {
      console.error("Error getting game:", error);
      throw error;
    }
  }

  /**
   * Get game with public fields only (no download_link)
   */
  async getGameForPublic(gameId: string): Promise<Game | null> {
    const knex = this.databaseService.getKnex();
    try {
      const game = await knex(this.tableName)
        .select(
          'gameId', 'name', 'description', 'price', 'owner_id', 'showInStore',
          'iconHash', 'splashHash', 'bannerHash', 'genre', 'release_date',
          'developer', 'publisher', 'platforms', 'rating', 'website',
          'trailer_link', 'multiplayer'
        )
        .where({ gameId: gameId })
        .first();
      return game || null;
    } catch (error) {
      console.error("Error getting public game:", error);
      throw error;
    }
  }

  /**
   * Get game with download_link if user owns it or is the creator
   */
  async getGameForOwner(gameId: string, userId: string): Promise<Game | null> {
    const knex = this.databaseService.getKnex();
    try {
      const game = await knex(this.tableName + ' as g')
        .leftJoin(this.gameOwnersTable + ' as go', function() {
          this.on('g.gameId', '=', 'go.gameId').andOn('go.ownerId', '=', knex.raw('?', [userId]))
        })
        .select(
          'g.*',
          knex.raw(`CASE WHEN g.owner_id = ? OR go.ownerId IS NOT NULL THEN g.download_link ELSE NULL END as download_link`, [userId])
        )
        .where('g.gameId', gameId)
        .first();
      return game || null;
    } catch (error) {
      console.error("Error getting game for owner:", error);
      throw error;
    }
  }

  async getUserGames(userId: string): Promise<Game[]> {
    const knex = this.databaseService.getKnex();
    try {
      const games = await knex(this.tableName + ' as g')
        .join(this.gameOwnersTable + ' as go', 'g.gameId', 'go.gameId')
        .select('g.*', 'g.download_link')
        .where('go.ownerId', userId);
      return games;
    } catch (error) {
      console.error("Error getting user games:", error);
      throw error;
    }
  }

  async listGames(): Promise<Game[]> {
    const knex = this.databaseService.getKnex();
    try {
      const games = await knex(this.tableName).select('*');
      return games;
    } catch (error) {
      console.error("Error listing games:", error);
      throw error;
    }
  }

  async getStoreGames(): Promise<Game[]> {
    const knex = this.databaseService.getKnex();
    try {
      const games = await knex(this.tableName)
        .select(
          'gameId', 'name', 'description', 'price', 'owner_id', 'showInStore',
          'iconHash', 'splashHash', 'bannerHash', 'genre', 'release_date',
          'developer', 'publisher', 'platforms', 'rating', 'website',
          'trailer_link', 'multiplayer'
        )
        .where({ showInStore: true });
      return games;
    } catch (error) {
      console.error("Error getting store games:", error);
      throw error;
    }
  }

  async getMyCreatedGames(userId: string): Promise<Game[]> {
    const knex = this.databaseService.getKnex();
    try {
      const games = await knex(this.tableName)
        .select('*')
        .where({ owner_id: userId });
      return games;
    } catch (error) {
      console.error("Error getting created games:", error);
      throw error;
    }
  }

  async getUserOwnedGames(userId: string): Promise<Game[]> {
    const knex = this.databaseService.getKnex();
    try {
      const games = await knex(this.tableName + ' as g')
        .join(this.gameOwnersTable + ' as go', 'g.gameId', 'go.gameId')
        .select('g.*')
        .where('go.ownerId', userId);
      return games;
    } catch (error) {
      console.error("Error getting owned games:", error);
      throw error;
    }
  }

  async searchGames(query: string): Promise<Game[]> {
    const knex = this.databaseService.getKnex();
    const searchTerm = `%${query.toLowerCase()}%`;
    try {
      const games = await knex(this.tableName)
        .select(
          'gameId', 'name', 'description', 'price', 'owner_id', 'showInStore',
          'iconHash', 'splashHash', 'bannerHash', 'genre', 'release_date',
          'developer', 'publisher', 'platforms', 'rating', 'website',
          'trailer_link', 'multiplayer'
        )
        .where({ showInStore: true })
        .andWhere(function() {
          this.where('name', 'like', searchTerm)
              .orWhere('description', 'like', searchTerm)
              .orWhere('genre', 'like', searchTerm);
        });
      return games;
    } catch (error) {
      console.error("Error searching games:", error);
      throw error;
    }
  }

  async createGame(game: Omit<Game, "id">): Promise<void> {
    const knex = this.databaseService.getKnex();
    try {
      await knex(this.tableName).insert({
        gameId: game.gameId,
        name: game.name,
        description: game.description,
        price: game.price,
        owner_id: game.owner_id,
        showInStore: toDbBool(game.showInStore),
        download_link: game.download_link,
        iconHash: game.iconHash ?? null,
        splashHash: game.splashHash ?? null,
        bannerHash: game.bannerHash ?? null,
        genre: game.genre ?? null,
        release_date: game.release_date ?? null,
        developer: game.developer ?? null,
        publisher: game.publisher ?? null,
        platforms: game.platforms ?? null,
        rating: game.rating ?? 0,
        website: game.website ?? null,
        trailer_link: game.trailer_link ?? null,
        multiplayer: toDbBool(game.multiplayer),
      });
    } catch (error) {
      console.error("Error creating game:", error);
      throw error;
    }
  }

  async updateGame(
    gameId: string,
    game: Partial<Omit<Game, "id" | "gameId">>
  ): Promise<void> {
    const knex = this.databaseService.getKnex();
    try {
      const { fields, values } = buildUpdateFields(game, ["owners"]);
      if (!fields.length) return;
      await knex(this.tableName)
        .where({ gameId: gameId })
        .update(Object.fromEntries(fields.map((field, index) => [field.split(' = ?')[0], values[index]])));
    } catch (error) {
      console.error("Error updating game:", error);
      throw error;
    }
  }

  async deleteGame(gameId: string): Promise<void> {
    const knex = this.databaseService.getKnex();
    try {
      await knex(this.tableName)
        .where({ gameId: gameId })
        .delete();
      await knex(this.gameOwnersTable)
        .where({ gameId: gameId })
        .delete();
    } catch (error) {
      console.error("Error deleting game:", error);
      throw error;
    }
  }

  async addOwner(gameId: string, ownerId: string): Promise<void> {
    const knex = this.databaseService.getKnex();
    try {
      await knex(this.gameOwnersTable).insert({
        gameId: gameId,
        ownerId: ownerId,
      });
    } catch (error) {
      console.error("Error adding owner:", error);
      throw error;
    }
  }

  async removeOwner(gameId: string, ownerId: string): Promise<void> {
    const knex = this.databaseService.getKnex();
    try {
      await knex(this.gameOwnersTable)
        .where({ gameId: gameId, ownerId: ownerId })
        .delete();
    } catch (error) {
      console.error("Error removing owner:", error);
      throw error;
    }
  }

  async transferOwnership(
    gameId: string,
    newOwnerId: string
  ): Promise<void> {
    const knex = this.databaseService.getKnex();
    try {
      const game = await this.getGame(gameId);
      if (!game) throw new Error("Game not found");
      await knex(this.tableName)
        .where({ gameId: gameId })
        .update({ owner_id: newOwnerId });
    } catch (error) {
      console.error("Error transferring ownership:", error);
      throw error;
    }
  }

  async canUserGiftGame(): Promise<boolean> {
    // Pour créer un gift, l'utilisateur doit juste avoir assez de crédits
    // Il n'a pas besoin de posséder le jeu
    return true;
  }

  async userOwnsGame(gameId: string, userId: string): Promise<boolean> {
    const knex = this.databaseService.getKnex();
    try {
      const count = await knex(this.gameOwnersTable)
        .where({ gameId: gameId, ownerId: userId })
        .count('ownerId as count')
        .first();
      return (Number(count?.count ?? 0)) > 0;
    } catch (error) {
      console.error("Error checking game ownership:", error);
      throw error;
    }
  }

  async transferGameCopy(gameId: string, fromUserId: string, toUserId: string): Promise<void> {
    try {
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
    } catch (error) {
      console.error("Error transferring game copy:", error);
      throw error;
    }
  }

  async canTransferGame(gameId: string, fromUserId: string, toUserId: string): Promise<{ canTransfer: boolean; reason?: string }> {
    try {
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
    } catch (error) {
      console.error("Error checking transfer eligibility:", error);
      return { canTransfer: false, reason: "An unexpected error occurred" };
    }
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
