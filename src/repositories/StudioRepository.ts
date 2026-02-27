import { IDatabaseService } from '../services/DatabaseService';

export class StudioRepository {
  constructor(private db: IDatabaseService) {}

  private studios() {
    return this.db.from<{ user_id: string; admin_id: string; users: string[] }>('studios');
  }

  private parseUsers(users: string | string[]): string[] {
    return Array.isArray(users) ? users : JSON.parse(users);
  }

  async getStudio(user_id: string) {
    const { data, error } = await this.studios().select('*').eq('user_id', user_id).limit(1);
    if (error) throw error;
    return data && data.length ? data[0] : null;
  }

  async setStudioProperties(user_id: string, admin_id: string, userIds: string[]) {
    const { error } = await this.studios().update({ admin_id, users: userIds }).eq('user_id', user_id);
    if (error) throw error;
  }

  async getUserStudios(user_id: string) {
    // Postgres can use array contains, sqlite fallbacks to LIKE via raw query
    if (this.db.isPostgres()) {
      const { data, error } = await this.studios()
        .select('*')
        .or(`admin_id.eq.${user_id},users.cs.{"${user_id}"}`); // cs = contains operator
      if (error) throw error;
      return (data || []).map(s => ({ ...s, users: this.parseUsers(s.users) }));
    } else {
      const { data, error } = await this.db.read<{ user_id: string; admin_id: string; users: string }>(
        'SELECT * FROM studios WHERE admin_id = ? OR users LIKE ?',
        [user_id, `%"${user_id}"%`]
      );
      if (error) throw error;
      return data.map(s => ({ ...s, users: this.parseUsers(s.users) }));
    }
  }

  async createStudio(user_id: string, admin_id: string) {
    const { error } = await this.studios().insert({ user_id, admin_id, users: [] });
    if (error) throw error;
  }
}
