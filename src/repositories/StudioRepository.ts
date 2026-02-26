import { Studio } from 'interfaces/Studio';
import { IDatabaseService } from '../services/DatabaseService';

export class StudioRepository {
  constructor(private db: IDatabaseService) {}

  private parseUsers(users: string | string[]): string[] {
    return Array.isArray(users) ? users : JSON.parse(users);
  }

  async getStudio(user_id: string): Promise<Studio | null> {
    const db = await this.db.getDb();
    const studio = await db.collection('studios').findOne({ user_id });
    if (!studio) return null;
    return {
      ...studio,
      users: studio.users,
      admin_id: studio.admin_id,
      user_id: studio.user_id,
      me: studio.user_id,
    };
  }

  async setStudioProperties(user_id: string, admin_id: string, userIds: string[]) {
    const db = await this.db.getDb();
    await db.collection('studios').updateOne(
      { user_id },
      { $set: { admin_id, users: userIds } }
    );
  }

  async getUserStudios(user_id: string): Promise<Array<{ user_id: string; admin_id: string; users: string[] }>> {
    const db = await this.db.getDb();
    const docs = await db.collection('studios').find({
      $or: [
        { admin_id: user_id },
        { users: user_id }
      ]
    }).toArray();
    // return docs.map(s => ({ ...s, users: this.parseUsers(s.users) }));
    const studios: Array<{ user_id: string; admin_id: string; users: string[] }> = [];
    for (const doc of docs) {
      const users = this.parseUsers(doc.users);
      studios.push({
        user_id: doc.user_id,
        admin_id: doc.admin_id,
        users,
      });
    }
    return studios;
  }

  async createStudio(user_id: string, admin_id: string) {
    const db = await this.db.getDb();
    await db.collection('studios').insertOne({ user_id, admin_id, users: [] });
  }
}
