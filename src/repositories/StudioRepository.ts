import { IDatabaseService } from "../services/DatabaseService";

export class StudioRepository {
  constructor(private db: IDatabaseService) {}

  private parseUsers(users: string | string[]): string[] {
    return Array.isArray(users) ? users : JSON.parse(users);
  }

  async getStudio(user_id: string) {
    const res = await this.db.read<{ user_id: string, admin_id: string, users: string[] }>(
      "SELECT * FROM studios WHERE user_id = ?", [user_id]
    );
    return res[0] ?? null;
  }

  async setStudioProperties(user_id: string, admin_id: string, userIds: string[]) {
    await this.db.request(
      "UPDATE studios SET admin_id = ?, users = ? WHERE user_id = ?",
      [admin_id, JSON.stringify(userIds), user_id]
    );
  }

  async getUserStudios(user_id: string) {
    const studios = await this.db.read<{ user_id: string, admin_id: string, users: string }>(
      "SELECT * FROM studios WHERE admin_id = ? OR users LIKE ?",
      [user_id, `%"${user_id}"%`]
    );
    return studios.map(s => ({ ...s, users: this.parseUsers(s.users) }));
  }

  async createStudio(user_id: string, admin_id: string) {
    await this.db.request(
      "INSERT INTO studios (user_id, admin_id, users) VALUES (?, ?, ?)",
      [user_id, admin_id, JSON.stringify([])]
    );
  }
}
