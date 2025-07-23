/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Lobby } from "../interfaces/Lobbies";
import { User } from "interfaces/User";
import { IUserService } from "./UserService";

export interface ILobbyService {
  getLobby(lobbyId: string): Promise<Lobby | null>;
  joinLobby(lobbyId: string, userId: string): Promise<void>;
  leaveLobby(lobbyId: string, userId: string): Promise<void>;
  getUserLobby(
    userId: string
  ): Promise<{ lobbyId: string; users: (User | null)[] } | null>;
  createLobby(lobbyId: string, users?: string[]): Promise<void>;
  deleteLobby(lobbyId: string): Promise<void>;
}

@injectable()
export class LobbyService implements ILobbyService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("UserService") private userService: IUserService
  ) {}

  async getLobby(lobbyId: string): Promise<Lobby | null> {
    const rows = await this.databaseService.read<Lobby[]>(
      "SELECT users FROM lobbies WHERE lobbyId = ?",
      [lobbyId]
    );
    return rows[0] || null;
  }

  async joinLobby(lobbyId: string, userId: string): Promise<void> {
    const lobby = await this.getLobby(lobbyId);
    if (!lobby) throw new Error("Lobby not found");
    const users = [...new Set([...parseUsers(lobby.users), userId])];
    await this.databaseService.update(
      "UPDATE lobbies SET users = ? WHERE lobbyId = ?",
      [JSON.stringify(users), lobbyId]
    );
  }

  async leaveLobby(lobbyId: string, userId: string): Promise<void> {
    const lobby = await this.getLobby(lobbyId);
    if (!lobby) throw new Error("Lobby not found");
    const newUsers = parseUsers(lobby.users).filter((u) => u !== userId);
    if (newUsers.length === 0) {
      await this.deleteLobby(lobbyId);
    } else {
      await this.databaseService.update(
        "UPDATE lobbies SET users = ? WHERE lobbyId = ?",
        [JSON.stringify(newUsers), lobbyId]
      );
    }
  }

  async getUserLobby(
    userId: string
  ): Promise<{ lobbyId: string; users: any[] } | null> {
    const rows = await this.databaseService.read<
      { lobbyId: string; users: string }[]
    >("SELECT lobbyId, users FROM lobbies");
    for (const row of rows) {
      const userIds = parseUsers(row.users);
      if (!userIds.includes(userId)) continue;
      const users = (await Promise.all(userIds.map((u) => this.userService.getUser(u))))
        .filter((user): user is User => user !== null)
        .map(mapLobbyUser);
      return { lobbyId: row.lobbyId, users };
    }
    return null;
  }

  async createLobby(lobbyId: string, users: string[] = []): Promise<void> {
    await this.databaseService.update(
      "INSERT INTO lobbies (lobbyId, users) VALUES (?, ?)",
      [lobbyId, JSON.stringify(users)]
    );
  }

  async deleteLobby(lobbyId: string): Promise<void> {
    await this.databaseService.update("DELETE FROM lobbies WHERE lobbyId = ?", [
      lobbyId,
    ]);
  }
}

function mapLobbyUser(user: User) {
  return {
    username: user.username,
    user_id: user.user_id,
    verified: user.verified,
    steam_username: user.steam_username,
    steam_avatar_url: user.steam_avatar_url,
    steam_id: user.steam_id,
  };
}

function parseUsers(users: string): string[] {
  try {
    return JSON.parse(users);
  } catch {
    return [];
  }
}
