import { Badge, BadgeType } from '../interfaces/Badge';
import { IDatabaseService } from '../services/DatabaseService';

export class BadgeRepository {
  constructor(private databaseService: IDatabaseService) {}

  async getBadgeTypes(): Promise<BadgeType[]> {
    // const result = await this.databaseService.read<BadgeType>('SELECT * FROM badge_types ORDER BY id');
    
    // MongoDB query to get badge types
    const db = await this.databaseService.getDb();
    const result = await db.collection('badge_types').find().sort({ id: 1 }).toArray();

    // Convert MongoDB documents to BadgeType interface if necessary
    const badgeTypes: BadgeType[] = result.map(doc => ({
      id: doc.id,
      name: doc.name,
      display_name: doc.display_name,
      color: doc.color,
      icon: doc.icon,
      duration_days: doc.duration_days
    }));
    return badgeTypes;
  }

  async getActiveBadgesForGame(gameId: string): Promise<Badge[]> {
    // const result = await this.databaseService.read<Badge>(
    //   `SELECT 
    //     b.id, b.name, b.display_name, b.color, b.icon, gb.expires_at
    //   FROM game_badges gb
    //   JOIN badge_types b ON gb.badge_id = b.id
    //   WHERE gb.game_id = ? AND gb.expires_at > NOW()
    //   ORDER BY gb.created_at DESC`,
    //   [gameId]
    // );
    // MongoDB query to get active badges for a game
    const db = await this.databaseService.getDb();
    const result = await db.collection('game_badges').aggregate([
      { $match: { gameId: gameId, expires_at: { $gt: new Date() } } },
      // use pipeline style lookup to avoid driver errors and give us more control
      { $lookup: {
          from: 'badge_types',
          let: { badgeId: '$badgeId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$id', '$$badgeId'] } } }
          ],
          as: 'badge_info'
        }
      },
      { $unwind: '$badge_info' },
      { $project: {
          id: '$badge_info.id',
          name: '$badge_info.name',
          display_name: '$badge_info.display_name',
          color: '$badge_info.color',
          icon: '$badge_info.icon',
          expires_at: '$expires_at'
        }
      },
      { $sort: { created_at: -1 } }
    ]).toArray();

    // Convert MongoDB documents to Badge interface if necessary
    const badges: Badge[] = result.map(doc => ({
      id: doc.id,
      name: doc.name,
      display_name: doc.display_name,
      color: doc.color,
      icon: doc.icon,
      expires_at: doc.expires_at
    }));
    return badges;
  }

  async addBadgeToGame(gameId: string, badgeId: number, durationDays: number): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // await this.databaseService.request(
    //   `INSERT INTO game_badges (game_id, badge_id, created_at, expires_at)
    //    VALUES (?, ?, NOW(), ?)
    //    ON DUPLICATE KEY UPDATE 
    //    created_at = NOW(), expires_at = ?`,
    //   [gameId, badgeId, expiresAt, expiresAt]
    // );
    // MongoDB query to add badge to game
    const db = await this.databaseService.getDb();
    await db.collection('game_badges').updateOne(
      { gameId: gameId, badgeId: badgeId },
      { $set: { created_at: new Date(), expires_at: expiresAt } },
      { upsert: true }
    );
  }

  async removeExpiredBadges(): Promise<void> {
    // await this.databaseService.request('DELETE FROM game_badges WHERE expires_at < NOW()');
    // MongoDB query to remove expired badges
    const db = await this.databaseService.getDb();
    await db.collection('game_badges').deleteMany({ expires_at: { $lt: new Date() } });
  }

  async getBadgeTypeByName(name: string): Promise<BadgeType | null> {
    // const result = await this.databaseService.read<BadgeType>('SELECT * FROM badge_types WHERE name = ?', [name]);
    const db = await this.databaseService.getDb();
    const result = await db.collection('badge_types').find({ name: name }).toArray();

    // Convert MongoDB document to BadgeType interface if necessary
    const badgeTypes: BadgeType[] = result.map(doc => ({
      id: doc.id,
      name: doc.name,
      display_name: doc.display_name,
      color: doc.color,
      icon: doc.icon,
      duration_days: doc.duration_days
    }));

    return badgeTypes.length > 0 ? badgeTypes[0] : null;
  }
}
