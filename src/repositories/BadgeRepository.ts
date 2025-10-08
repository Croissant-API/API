import { Badge, BadgeType } from "../interfaces/Badge";
import { IDatabaseService } from "../services/DatabaseService";

export class BadgeRepository {
  constructor(private databaseService: IDatabaseService) {}

  async getBadgeTypes(): Promise<BadgeType[]> {
    const result = await this.databaseService.read<BadgeType>(
      "SELECT * FROM badge_types ORDER BY id"
    );
    return result;
  }

  async getActiveBadgesForGame(gameId: string): Promise<Badge[]> {
    const result = await this.databaseService.read<Badge>(
      `SELECT 
        b.id, b.name, b.display_name, b.color, b.icon, gb.expires_at
      FROM game_badges gb
      JOIN badge_types b ON gb.badge_id = b.id
      WHERE gb.game_id = ? AND gb.expires_at > NOW()
      ORDER BY gb.created_at DESC`,
      [gameId]
    );
    return result;
  }

  async addBadgeToGame(gameId: string, badgeId: number, durationDays: number): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    await this.databaseService.request(
      `INSERT INTO game_badges (game_id, badge_id, created_at, expires_at)
       VALUES (?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE 
       created_at = NOW(), expires_at = ?`,
      [gameId, badgeId, expiresAt, expiresAt]
    );
  }

  async removeExpiredBadges(): Promise<void> {
    await this.databaseService.request(
      "DELETE FROM game_badges WHERE expires_at < NOW()"
    );
  }

  async getBadgeTypeByName(name: string): Promise<BadgeType | null> {
    const result = await this.databaseService.read<BadgeType>(
      "SELECT * FROM badge_types WHERE name = ?",
      [name]
    );
    return result.length > 0 ? result[0] : null;
  }
}

