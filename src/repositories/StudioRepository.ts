// ...existing code...
import { IDatabaseService } from "../services/DatabaseService";

export class StudioRepository {
  constructor(private databaseService: IDatabaseService) {}

  async getStudio(user_id: string): Promise<{user_id: string, admin_id: string, users: string[]}|null> {
    const studiosResponse = await this.databaseService.read<{user_id: string, admin_id: string, users: string[]}>("SELECT * FROM studios WHERE user_id = ?", [user_id]);
    return studiosResponse.length === 0 ? null : studiosResponse[0];
  }

  async setStudioProperties(user_id: string, admin_id: string, userIds: string[]): Promise<void> {
    await this.databaseService.request(
      "UPDATE studios SET admin_id = ?, users = ? WHERE user_id = ?",
      [admin_id, JSON.stringify(userIds), user_id]
    );
  }

  async getUserStudios(user_id: string): Promise<Array<{user_id: string, admin_id: string, users: string[]}>> {
    const studios = await this.databaseService.read<{
      user_id: string;
      admin_id: string;
      users: string;
    }>(`SELECT * FROM studios WHERE admin_id = ? OR users LIKE ?`, [
      user_id,
      `%"${user_id}"%`,
    ]);
    return studios.map(studio => ({
      ...studio,
      users: Array.isArray(studio.users) ? studio.users : JSON.parse(studio.users)
    }));
  }

  async createStudio(user_id: string, admin_id: string): Promise<void> {
    await this.databaseService.request(
      "INSERT INTO studios (user_id, admin_id, users) VALUES (?, ?, ?)",
      [user_id, admin_id, JSON.stringify([])]
    );
  }
}
