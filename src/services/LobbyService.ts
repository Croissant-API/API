import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Lobby } from "../interfaces/Lobbies";
import { User } from "interfaces/User";
import { IUserService } from "./UserService";

export interface ILobbyService {
  getLobby(lobbyId: string): Promise<Lobby | null>;
  joinLobby(lobbyId: string, userId: string): Promise<void>;
  leaveLobby(lobbyId: string, userId: string): Promise<void>;
  getUserLobby(userId: string): Promise<Lobby | null>;
  createLobby(lobbyId: string, users?: string[]): Promise<void>;
  deleteLobby(lobbyId: string): Promise<void>;
  getUserLobbies(userId: string): Promise<Lobby[]>;
  leaveAllLobbies(userId: string): Promise<void>;
}

@injectable()
export class LobbyService implements ILobbyService {
  private readonly tableName = "lobbies";

  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("UserService") private userService: IUserService
  ) {}

  async getLobby(lobbyId: string): Promise<Lobby | null> {
    const knex = this.databaseService.getKnex();

    try {
      const lobby = await knex(this.tableName)
        .select("lobbyId", "users")
        .where({ lobbyId: lobbyId })
        .first();

      if (!lobby) return null;

      const userIds: string[] = JSON.parse(lobby.users);
      const users = (await this.getUsersByIds(userIds)).filter((u) => !u.disabled);

      return { lobbyId: lobby.lobbyId, users };
    } catch (error) {
      console.error("Error getting lobby:", error);
      throw error;
    }
  }

  async joinLobby(lobbyId: string, userId: string): Promise<void> {
    const knex = this.databaseService.getKnex();

    try {
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) throw new Error("Lobby not found");

      const userIds = lobby.users.map((u) => u.user_id);
      const users = [...new Set([...userIds, userId])];

      await knex(this.tableName)
        .where({ lobbyId: lobbyId })
        .update({ users: JSON.stringify(users) });
    } catch (error) {
      console.error("Error joining lobby:", error);
      throw error;
    }
  }

  async leaveLobby(lobbyId: string, userId: string): Promise<void> {
    const knex = this.databaseService.getKnex();

    try {
      const lobby = await this.getLobby(lobbyId);
      if (!lobby) throw new Error("Lobby not found");

      const newUsers = lobby.users.filter((u) => u.user_id !== userId).map(u => u.user_id);

      await knex(this.tableName)
        .where({ lobbyId: lobbyId })
        .update({ users: JSON.stringify(newUsers) });

      // if (newUsers.length === 0) {
      //   await this.deleteLobby(lobbyId);
      // }
    } catch (error) {
      console.error("Error leaving lobby:", error);
      throw error;
    }
  }

  async getUserLobby(userId: string): Promise<Lobby | null> {
    const knex = this.databaseService.getKnex();

    try {
      const lobby = await knex(this.tableName)
        .select("lobbyId", "users")
        .where('users', 'like', `%"${userId}"%`)
        .first();

      if (!lobby) return null;

      const userIds: string[] = JSON.parse(lobby.users);
      const users = (await this.getUsersByIds(userIds)).filter((u) => !u.disabled);

      return { lobbyId: lobby.lobbyId, users };
    } catch (error) {
      console.error("Error getting user lobby:", error);
      throw error;
    }
  }

  async createLobby(lobbyId: string, users: string[] = []): Promise<void> {
    const knex = this.databaseService.getKnex();

    try {
      await knex(this.tableName).insert({
        lobbyId: lobbyId,
        users: JSON.stringify(users),
      });
    } catch (error) {
      console.error("Error creating lobby:", error);
      throw error;
    }
  }

  async deleteLobby(lobbyId: string): Promise<void> {
    const knex = this.databaseService.getKnex();

    try {
      await knex(this.tableName).where({ lobbyId: lobbyId }).delete();
    } catch (error) {
      console.error("Error deleting lobby:", error);
      throw error;
    }
  }

  async getUserLobbies(userId: string): Promise<Lobby[]> {
    const knex = this.databaseService.getKnex();

    try {
      const lobbies = await knex(this.tableName)
        .select("lobbyId", "users")
        .where('users', 'like', `%"${userId}"%`);

      return Promise.all(
        lobbies.map(async (lobby) => {
          const userIds: string[] = JSON.parse(lobby.users);
          const users = (await this.getUsersByIds(userIds)).filter((u) => !u.disabled);
          return { lobbyId: lobby.lobbyId, users };
        })
      );
    } catch (error) {
      console.error("Error getting user lobbies:", error);
      throw error;
    }
  }

  async leaveAllLobbies(userId: string): Promise<void> {
    try {
      const lobbies = await this.getUserLobbies(userId);
      for (const lobby of lobbies) {
        await this.leaveLobby(lobby.lobbyId, userId);
      }
    } catch (error) {
      console.error("Error leaving all lobbies:", error);
      throw error;
    }
  }

  private async getUsersByIds(userIds: string[]): Promise<User[]> {
    const knex = this.databaseService.getKnex();

    try {
      if (userIds.length === 0) return [];

      return await knex("users")
        .select("user_id", "username", "verified", "admin")
        .whereIn("user_id", userIds);
    } catch (error) {
      console.error("Error getting users by ids:", error);
      throw error;
    }
  }
}
