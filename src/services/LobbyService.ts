/* eslint-disable @typescript-eslint/no-unused-vars */
import { inject, injectable } from "inversify";
import { IDatabaseConnection, IDatabaseService } from "./DatabaseService";
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
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("UserService") private userService: IUserService
  ) {}

  async getLobby(lobbyId: string): Promise<Lobby | null> {
    const lobby = await this.databaseService.read<{
      lobbyId: string;
      users: string[];
    }>(
      "SELECT lobbyId, users FROM lobbies WHERE lobbyId = ?",
      [lobbyId]
    );

    if (lobby.length === 0) return null;

    const userIds = lobby[0].users;
    const users = (await this.getUsersByIds(userIds)).filter((u) => !u.disabled);

    return { lobbyId: lobby[0].lobbyId, users };
  }

  async joinLobby(lobbyId: string, userId: string): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      // Récupérer le lobby avec verrouillage
      const lobbies = await connection.read<{
        lobbyId: string;
        users: string[];
      }>(
        "SELECT lobbyId, users FROM lobbies WHERE lobbyId = ? FOR UPDATE",
        [lobbyId]
      );

      if (lobbies.length === 0) {
        throw new Error("Lobby not found");
      }

      const lobby = lobbies[0];
      const currentUsers = Array.isArray(lobby.users) ? lobby.users : JSON.parse(lobby.users as string);
      
      // Vérifier si l'utilisateur n'est pas déjà dans le lobby
      if (currentUsers.includes(userId)) {
        return; // Utilisateur déjà présent, pas d'erreur
      }

      const updatedUsers = [...new Set([...currentUsers, userId])];
      
      await connection.request(
        "UPDATE lobbies SET users = ? WHERE lobbyId = ?",
        [JSON.stringify(updatedUsers), lobbyId]
      );
    });
  }

  async leaveLobby(lobbyId: string, userId: string): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      // Récupérer le lobby avec verrouillage
      const lobbies = await connection.read<{
        lobbyId: string;
        users: string[];
      }>(
        "SELECT lobbyId, users FROM lobbies WHERE lobbyId = ? FOR UPDATE",
        [lobbyId]
      );

      if (lobbies.length === 0) {
        throw new Error("Lobby not found");
      }

      const lobby = lobbies[0];
      const currentUsers = Array.isArray(lobby.users) ? lobby.users : JSON.parse(lobby.users as string);
      const newUsers = currentUsers.filter((id: string) => id !== userId);

      if (newUsers.length === 0) {
        // Supprimer le lobby s'il n'y a plus d'utilisateurs
        await connection.request(
          "DELETE FROM lobbies WHERE lobbyId = ?",
          [lobbyId]
        );
      } else {
        await connection.request(
          "UPDATE lobbies SET users = ? WHERE lobbyId = ?",
          [JSON.stringify(newUsers), lobbyId]
        );
      }
    });
  }

  async getUserLobby(userId: string): Promise<Lobby | null> {
    const lobbies = await this.databaseService.read<{
      lobbyId: string;
      users: string[];
    }>(
      "SELECT lobbyId, users FROM lobbies WHERE JSON_EXTRACT(users, '$') LIKE ?",
      [`%"${userId}"%`]
    );

    if (lobbies.length === 0) return null;

    const lobby = lobbies[0];
    const userIds = Array.isArray(lobby.users) ? lobby.users : JSON.parse(lobby.users as string);
    const users = (await this.getUsersByIds(userIds)).filter((u) => !u.disabled);
    return { lobbyId: lobby.lobbyId, users };
  }

  async createLobby(lobbyId: string, users: string[] = []): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      // Vérifier que le lobby n'existe pas déjà
      const existingLobbies = await connection.read<{ lobbyId: string }>(
        "SELECT lobbyId FROM lobbies WHERE lobbyId = ? FOR UPDATE",
        [lobbyId]
      );

      if (existingLobbies.length > 0) {
        throw new Error("Lobby already exists");
      }

      await connection.request(
        "INSERT INTO lobbies (lobbyId, users) VALUES (?, ?)",
        [lobbyId, JSON.stringify(users)]
      );
    });
  }

  async deleteLobby(lobbyId: string): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      // Vérifier que le lobby existe
      const existingLobbies = await connection.read<{ lobbyId: string }>(
        "SELECT lobbyId FROM lobbies WHERE lobbyId = ? FOR UPDATE",
        [lobbyId]
      );

      if (existingLobbies.length === 0) {
        throw new Error("Lobby not found");
      }

      await connection.request(
        "DELETE FROM lobbies WHERE lobbyId = ?",
        [lobbyId]
      );
    });
  }

  async getUserLobbies(userId: string): Promise<Lobby[]> {
    const lobbies = await this.databaseService.read<{
      lobbyId: string;
      users: string[];
    }>(
      "SELECT lobbyId, users FROM lobbies WHERE JSON_EXTRACT(users, '$') LIKE ?",
      [`%"${userId}"%`]
    );

    return Promise.all(
      lobbies.map(async (lobby) => {
        const userIds = Array.isArray(lobby.users) ? lobby.users : JSON.parse(lobby.users as string);
        const users = (await this.getUsersByIds(userIds)).filter((u) => !u.disabled);
        return { lobbyId: lobby.lobbyId, users };
      })
    );
  }

  async leaveAllLobbies(userId: string): Promise<void> {
    return await this.databaseService.transaction(async (connection: IDatabaseConnection) => {
      // Récupérer tous les lobbies contenant l'utilisateur avec verrouillage
      const lobbies = await connection.read<{
        lobbyId: string;
        users: string[];
      }>(
        "SELECT lobbyId, users FROM lobbies WHERE JSON_EXTRACT(users, '$') LIKE ? FOR UPDATE",
        [`%"${userId}"%`]
      );

      for (const lobby of lobbies) {
        const currentUsers = Array.isArray(lobby.users) ? lobby.users : JSON.parse(lobby.users as string);
        const newUsers = currentUsers.filter((id: string) => id !== userId);

        if (newUsers.length === 0) {
          // Supprimer le lobby s'il n'y a plus d'utilisateurs
          await connection.request(
            "DELETE FROM lobbies WHERE lobbyId = ?",
            [lobby.lobbyId]
          );
        } else {
          await connection.request(
            "UPDATE lobbies SET users = ? WHERE lobbyId = ?",
            [JSON.stringify(newUsers), lobby.lobbyId]
          );
        }
      }
    });
  }

  private async getUsersByIds(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];

    return await this.databaseService.read<User>(
      `SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds
        .map(() => "?")
        .join(",")})`,
      userIds
    );
  }
}
