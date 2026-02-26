import { GameViewStats } from '../interfaces/GameView';
import { IDatabaseService } from '../services/DatabaseService';

export class GameViewRepository {
  constructor(private databaseService: IDatabaseService) {}

  async addView(gameId: string, viewerCookie: string, ipAddress: string, userAgent?: string): Promise<void> {
    await this.databaseService.request(
      `INSERT INTO game_views (game_id, viewer_cookie, ip_address, viewed_at, user_agent)
       VALUES ($1, $2, $3, NOW(), $4)`,
      [gameId, viewerCookie, ipAddress, userAgent || null]
    );
  }

  async hasViewedToday(gameId: string, viewerCookie: string): Promise<boolean> {
    const result = await this.databaseService.read<{ count: number }>(
      `SELECT COUNT(*) as count FROM game_views 
       WHERE game_id = $1 AND viewer_cookie = $2 
       AND DATE(viewed_at) = CURRENT_DATE`,
      [gameId, viewerCookie]
    );
    return result.length > 0 && result[0].count > 0;
  }

  async getGameViewStats(gameId: string): Promise<GameViewStats> {
    const result = await this.databaseService.read<GameViewStats>(
      `SELECT 
        $1 as gameId,
        COUNT(*) as total_views,
        COUNT(DISTINCT viewer_cookie) as unique_views,
        COUNT(CASE WHEN DATE(viewed_at) = CURRENT_DATE THEN 1 END) as views_today,
        COUNT(CASE WHEN viewed_at >= NOW() - INTERVAL '7 days' THEN 1 END) as views_this_week,
        COUNT(CASE WHEN viewed_at >= NOW() - INTERVAL '30 days' THEN 1 END) as views_this_month
      FROM game_views 
      WHERE game_id = $2`,
      [gameId, gameId]
    );
    return result.length > 0
      ? result[0]
      : { gameId, total_views: 0, unique_views: 0, views_today: 0, views_this_week: 0, views_this_month: 0 };
  }

  async getViewsForGames(gameIds: string[]): Promise<Record<string, GameViewStats>> {
    if (gameIds.length === 0) return {};

    const placeholders = gameIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await this.databaseService.read<GameViewStats>(
      `SELECT 
        game_id as gameId,
        COUNT(*) as total_views,
        COUNT(DISTINCT viewer_cookie) as unique_views,
        COUNT(CASE WHEN DATE(viewed_at) = CURRENT_DATE THEN 1 END) as views_today,
        COUNT(CASE WHEN viewed_at >= NOW() - INTERVAL '7 days' THEN 1 END) as views_this_week,
        COUNT(CASE WHEN viewed_at >= NOW() - INTERVAL '30 days' THEN 1 END) as views_this_month
      FROM game_views 
      WHERE game_id IN (${placeholders})
      GROUP BY game_id`,
      gameIds
    );

    const stats: Record<string, GameViewStats> = {};
    for (const row of result) {
      stats[row.gameId] = row;
    }

    for (const gameId of gameIds) {
      if (!stats[gameId]) {
        stats[gameId] = {
          gameId,
          total_views: 0,
          unique_views: 0,
          views_today: 0,
          views_this_week: 0,
          views_this_month: 0,
        };
      }
    }

    return stats;
  }

  async cleanupOldViews(daysToKeep: number = 365): Promise<void> {
    // Postgres interval concatenation; parameterize days
    // build interval value by appending ' days'
    await this.databaseService.request("DELETE FROM game_views WHERE viewed_at < NOW() - ($1 || ' days')::interval", [daysToKeep]);
  }
}
