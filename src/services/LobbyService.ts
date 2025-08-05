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
    const lobby = await this.getLobby(lobbyId);
    if (!lobby) throw new Error("Lobby not found");
    const users = [...new Set([...lobby.users.map((u) => u.user_id), userId])];
    await this.databaseService.request(
      "UPDATE lobbies SET users = ? WHERE lobbyId = ?",
      [JSON.stringify(users), lobbyId]
    );
  }

  async leaveLobby(lobbyId: string, userId: string): Promise<void> {
    const lobby = await this.getLobby(lobbyId);
    if (!lobby) throw new Error("Lobby not found");
    const newUsers = lobby.users.filter((u) => u.user_id !== userId);
    if (newUsers.length === 0) {
      // await this.deleteLobby(lobbyId);
    } else {
      await this.databaseService.request(
        "UPDATE lobbies SET users = ? WHERE lobbyId = ?",
        [JSON.stringify(newUsers.map((u) => u.user_id)), lobbyId]
      );
    }
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
    const userIds = lobby.users;
    const users = (await this.getUsersByIds(userIds)).filter((u) => !u.disabled);
    return { lobbyId: lobby.lobbyId, users };
  }

  async createLobby(lobbyId: string, users: string[] = []): Promise<void> {
    await this.databaseService.request(
      "INSERT INTO lobbies (lobbyId, users) VALUES (?, ?)",
      [lobbyId, JSON.stringify(users)]
    );
  }

  async deleteLobby(lobbyId: string): Promise<void> {
    await this.databaseService.request("DELETE FROM lobbies WHERE lobbyId = ?", [
      lobbyId,
    ]);
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
        const userIds = lobby.users;
        const users = (await this.getUsersByIds(userIds)).filter((u) => !u.disabled);
        return { lobbyId: lobby.lobbyId, users };
      })
    );
  }

  async leaveAllLobbies(userId: string): Promise<void> {
    const lobbies = await this.getUserLobbies(userId);
    for (const lobby of lobbies) {
      await this.leaveLobby(lobby.lobbyId, userId);
    }
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
