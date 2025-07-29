import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Lobby } from "../interfaces/Lobbies";
import { User } from "interfaces/User";
import { IUserService } from "./UserService";

interface LobbyUser {
  username: string;
  user_id: string;
  verified: boolean;
  steam_username?: string;
  steam_avatar_url?: string;
  steam_id?: string;
}

export interface ILobbyService {
  getLobby(lobbyId: string): Promise<Lobby | null>;
  getFormattedLobby(lobbyId: string): Promise<{ lobbyId: string; users: LobbyUser[] } | null>;
  joinLobby(lobbyId: string, userId: string): Promise<void>;
  leaveLobby(lobbyId: string, userId: string): Promise<void>;
  getUserLobby(
    userId: string
  ): Promise<{ lobbyId: string; users: LobbyUser[] } | null>;
  getFormattedLobbyUsers(userIds: string[]): Promise<LobbyUser[]>;
  createLobby(lobbyId: string, users?: string[]): Promise<void>;
  deleteLobby(lobbyId: string): Promise<void>;
  getUserLobbies(userId: string): Promise<{ lobbyId: string; users: string }[]>;
  leaveAllLobbies(userId: string): Promise<void>;
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

  async getFormattedLobby(lobbyId: string): Promise<{ lobbyId: string; users: LobbyUser[] } | null> {
    const lobby = await this.getLobby(lobbyId);
    if (!lobby) return null;
    
    const userIds = parseUsers(lobby.users);
    const users = await this.getFormattedLobbyUsers(userIds);
    return { lobbyId, users };
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
  ): Promise<{ lobbyId: string; users: LobbyUser[] } | null> {
    const rows = await this.databaseService.read<
      { lobbyId: string; users: string }[]
    >("SELECT lobbyId, users FROM lobbies WHERE JSON_EXTRACT(users, '$') LIKE ?", 
    [`%"${userId}"%`]);
    
    if (rows.length === 0) return null;
    
    const row = rows[0];
    const userIds = parseUsers(row.users);
    const users = await this.getFormattedLobbyUsers(userIds);
    return { lobbyId: row.lobbyId, users };
  }

  async getFormattedLobbyUsers(userIds: string[]): Promise<LobbyUser[]> {
    if (userIds.length === 0) return [];
    
    const placeholders = userIds.map(() => '?').join(',');
    const users = await this.databaseService.read<User[]>(
      `SELECT user_id, username, verified, steam_username, steam_avatar_url, steam_id 
       FROM users 
       WHERE user_id IN (${placeholders})`,
      userIds
    );
    
    return users.map(mapLobbyUser);
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

  async getUserLobbies(userId: string): Promise<{ lobbyId: string; users: string }[]> {
    return await this.databaseService.read<{ lobbyId: string; users: string }[]>(
      "SELECT lobbyId, users FROM lobbies WHERE JSON_EXTRACT(users, '$') LIKE ?",
      [`%"${userId}"%`]
    );
  }

  async leaveAllLobbies(userId: string): Promise<void> {
    const lobbies = await this.getUserLobbies(userId);
    for (const lobby of lobbies) {
      await this.leaveLobby(lobby.lobbyId, userId);
    }
  }
}

function mapLobbyUser(user: User): LobbyUser {
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
