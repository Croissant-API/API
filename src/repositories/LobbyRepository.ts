import { IDatabaseService } from "../services/DatabaseService";

export class LobbyRepository {
  constructor(private databaseService: IDatabaseService) { }

  async getLobby(lobbyId: string): Promise<{ lobbyId: string; users: string[] } | null> {
    const lobby = await this.databaseService.read<{
      lobbyId: string;
      users: string[];
    }>(
      "SELECT lobbyId, users FROM lobbies WHERE lobbyId = ?",
      [lobbyId]
    );
    return lobby.length === 0 ? null : lobby[0];
  }

  async updateLobbyUsers(lobbyId: string, users: string[]): Promise<void> {
    await this.databaseService.request(
      "UPDATE lobbies SET users = ? WHERE lobbyId = ?",
      [JSON.stringify(users), lobbyId]
    );
  }

  async getUserLobby(userId: string): Promise<{ lobbyId: string; users: string[] } | null> {
    const lobbies = await this.databaseService.read<{
      lobbyId: string;
      users: string[];
    }>(
      "SELECT lobbyId, users FROM lobbies WHERE JSON_EXTRACT(users, '$') LIKE ?",
      [`%"${userId}%"`]
    );
    return lobbies.length === 0 ? null : lobbies[0];
  }

  async createLobby(lobbyId: string, users: string[] = []): Promise<void> {
    await this.databaseService.request(
      "INSERT INTO lobbies (lobbyId, users) VALUES (?, ?)",
      [lobbyId, JSON.stringify(users)]
    );
  }

  async deleteLobby(lobbyId: string): Promise<void> {
    await this.databaseService.request("DELETE FROM lobbies WHERE lobbyId = ?", [lobbyId]);
  }

  async getUserLobbies(userId: string): Promise<{ lobbyId: string; users: string[] }[]> {
    return await this.databaseService.read<{
      lobbyId: string;
      users: string[];
    }>(
      "SELECT lobbyId, users FROM lobbies WHERE JSON_EXTRACT(users, '$') LIKE ?",
      [`%"${userId}%"`]
    );
  }
}
