import { IDatabaseService } from "../services/DatabaseService";
import { GameView, GameViewStats } from "../interfaces/GameView";

export class GameViewRepository {
  constructor(private databaseService: IDatabaseService) {}

  async addView(gameId: string, viewerCookie: string, ipAddress: string, userAgent?: string): Promise<void> {
    await this.databaseService.request(
      `INSERT INTO game_views (game_id, viewer_cookie, ip_address, viewed_at, user_agent)
       VALUES (?, ?, ?, NOW(), ?)`,
      [gameId, viewerCookie, ipAddress, userAgent || null]
    );
  }

  async hasViewedToday(gameId: string, viewerCookie: string): Promise<boolean> {
    const result = await this.databaseService.read<{ count: number }>(
      `SELECT COUNT(*) as count FROM game_views 
       WHERE game_id = ? AND viewer_cookie = ? 
       AND DATE(viewed_at) = CURDATE()`,
      [gameId, viewerCookie]
    );
    return result.length > 0 && result[0].count > 0;
  }

  async getGameViewStats(gameId: string): Promise<GameViewStats> {
    const result = await this.databaseService.read<GameViewStats>(
      `SELECT 
        ? as gameId,
        COUNT(*) as total_views,
        COUNT(DISTINCT viewer_cookie) as unique_views,
        COUNT(CASE WHEN DATE(viewed_at) = CURDATE() THEN 1 END) as views_today,
        COUNT(CASE WHEN viewed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as views_this_week,
        COUNT(CASE WHEN viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as views_this_month
      FROM game_views 
      WHERE game_id = ?`,
      [gameId, gameId]
    );
    return result.length > 0 ? result[0] : { gameId, total_views: 0, unique_views: 0, views_today: 0, views_this_week: 0, views_this_month: 0 };
  }

  async getViewsForGames(gameIds: string[]): Promise<Record<string, GameViewStats>> {
    if (gameIds.length === 0) return {};

    const placeholders = gameIds.map(() => '?').join(',');
    const result = await this.databaseService.read<GameViewStats>(
      `SELECT 
        game_id as gameId,
        COUNT(*) as total_views,
        COUNT(DISTINCT viewer_cookie) as unique_views,
        COUNT(CASE WHEN DATE(viewed_at) = CURDATE() THEN 1 END) as views_today,
        COUNT(CASE WHEN viewed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as views_this_week,
        COUNT(CASE WHEN viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as views_this_month
      FROM game_views 
      WHERE game_id IN (${placeholders})
      GROUP BY game_id`,
      gameIds
    );

    const stats: Record<string, GameViewStats> = {};
    for (const row of result) {
      stats[row.gameId] = row;
    }

    // Ensure all requested games have stats (even if 0)
    for (const gameId of gameIds) {
      if (!stats[gameId]) {
        stats[gameId] = {
          gameId,
          total_views: 0,
          unique_views: 0,
          views_today: 0,
          views_this_week: 0,
          views_this_month: 0
        };
      }
    }

    return stats;
  }

  async cleanupOldViews(daysToKeep: number = 365): Promise<void> {
    await this.databaseService.request(
      "DELETE FROM game_views WHERE viewed_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
      [daysToKeep]
    );
  }
}
