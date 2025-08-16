import { IDatabaseService } from "../services/DatabaseService";
import { Lobby } from "../interfaces/Lobbies";
import { PublicUser } from "../interfaces/User";

export class LobbyRepository {
  constructor(private databaseService: IDatabaseService) { }

  // Méthode générique pour récupérer les lobbies selon des filtres
  async getLobbies(
    filters: { lobbyId?: string; userId?: string } = {}
  ): Promise<Lobby[]> {
    const query = "SELECT lobbyId, users FROM lobbies WHERE 1=1";
    const rows = await this.databaseService.read<{ lobbyId: string; users: string[] }>(query);
    // Parse users JSON for all lobbies
    const lobbies: Lobby[] = [];
    for (const row of rows) {
      if(filters.userId && row.users.indexOf(filters.userId) !== -1 && filters.userId) {
        const users = await this.getUsersByIds(row.users);
        lobbies.push({
          lobbyId: row.lobbyId,
          users
        });
      }
      else if (filters.lobbyId && row.lobbyId === filters.lobbyId) {
        const users = await this.getUsersByIds(row.users);
        lobbies.push({
          lobbyId: row.lobbyId,
          users
        });
      }
    }
    return lobbies;
  }

  // Surcharges utilisant la méthode générique
  async getLobby(lobbyId: string): Promise<Lobby | null> {
    const lobbies = await this.getLobbies({ lobbyId });
    return lobbies[0] || null;
  }

  async getUserLobby(userId: string): Promise<Lobby | null> {
    const lobbies = await this.getLobbies({ userId });
    if (lobbies.length === 0) return null;
    return lobbies ? { lobbyId: lobbies[0].lobbyId, users: lobbies[0].users } : null;
  }

  async getUserLobbies(userId: string): Promise<Lobby[]> {
    return this.getLobbies({ userId });
  }

  async createLobby(lobbyId: string, users: string[] = []): Promise<void> {
    await this.databaseService.request(
      "INSERT INTO lobbies (lobbyId, users) VALUES (?, ?)",
      [lobbyId, JSON.stringify(users)]
    );
  }

  async updateLobbyUsers(lobbyId: string, users: PublicUser[]): Promise<void> {
    const usersIds = await this.getUsersIdOnly(users);
    await this.databaseService.request(
      "UPDATE lobbies SET users = ? WHERE lobbyId = ?",
      [JSON.stringify(usersIds), lobbyId]
    );
  }

  async deleteLobby(lobbyId: string): Promise<void> {
    await this.databaseService.request("DELETE FROM lobbies WHERE lobbyId = ?", [lobbyId]);
  }


  private async getUsersByIds(userIds: string[]): Promise<PublicUser[]> {
    if (userIds.length === 0) return [];

    return await this.databaseService.read<PublicUser>(
      `SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds
        .map(() => "?")
        .join(",")}) AND disabled = 0`,
      userIds
    );
  }

  private async getUsersIdOnly(users: PublicUser[]): Promise<string[]> {
    return users.map(user => user.user_id);
  }
}
