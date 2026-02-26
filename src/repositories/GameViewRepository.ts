import { GameViewStats } from '../interfaces/GameView';
import { IDatabaseService } from '../services/DatabaseService';

export class GameViewRepository {
  constructor(private databaseService: IDatabaseService) { }

  async addView(gameId: string, viewerCookie: string, ipAddress: string, userAgent?: string): Promise<void> {
    // await this.databaseService.request(
    //   `INSERT INTO game_views (game_id, viewer_cookie, ip_address, viewed_at, user_agent)
    //    VALUES (?, ?, ?, NOW(), ?)`,
    //   [gameId, viewerCookie, ipAddress, userAgent || null]
    // );
    // MongoDB query to add a game view
    const db = await this.databaseService.getDb();
    await db.collection('game_views').insertOne({
      game_id: gameId,
      viewer_cookie: viewerCookie,
      ip_address: ipAddress,
      viewed_at: new Date(),
      user_agent: userAgent || null
    });
  }

  async hasViewedToday(gameId: string, viewerCookie: string): Promise<boolean> {
    // const result = await this.databaseService.read<{ count: number }>(
    //   `SELECT COUNT(*) as count FROM game_views 
    //    WHERE game_id = ? AND viewer_cookie = ? 
    //    AND DATE(viewed_at) = CURDATE()`,
    //   [gameId, viewerCookie]
    // );
    // return result.length > 0 && result[0].count > 0;
    // MongoDB query to check if the viewer has viewed the game today
    const db = await this.databaseService.getDb();
    const count = await db.collection('game_views').countDocuments({
      game_id: gameId,
      viewer_cookie: viewerCookie,
      viewed_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    return count > 0;
  }

  async getGameViewStats(gameId: string): Promise<GameViewStats> {
    // const result = await this.databaseService.read<GameViewStats>(
    //   `SELECT 
    //     ? as gameId,
    //     COUNT(*) as total_views,
    //     COUNT(DISTINCT viewer_cookie) as unique_views,
    //     COUNT(CASE WHEN DATE(viewed_at) = CURDATE() THEN 1 END) as views_today,
    //     COUNT(CASE WHEN viewed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as views_this_week,
    //     COUNT(CASE WHEN viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as views_this_month
    //   FROM game_views 
    //   WHERE game_id = ?`,
    //   [gameId, gameId]
    // );
    // return result.length > 0 ? result[0] : { gameId, total_views: 0, unique_views: 0, views_today: 0, views_this_week: 0, views_this_month: 0 };
    // MongoDB query to get game view stats
    const db = await this.databaseService.getDb();
    const result = await db.collection('game_views').aggregate([
      { $match: { game_id: gameId } },
      {
        $group: {
          _id: '$game_id',
          total_views: { $sum: 1 },
          unique_views: { $addToSet: '$viewer_cookie' },
          views_today: { $sum: { $cond: [{ $eq: [{ $dateToString: { format: "%Y-%m-%d", date: "$viewed_at" } }, new Date().toISOString().split('T')[0]] }, 1, 0] } },
          views_this_week: { $sum: { $cond: [{ $gte: ['$viewed_at', new Date(new Date().setDate(new Date().getDate() - 7))] }, 1, 0] } },
          views_this_month: { $sum: { $cond: [{ $gte: ['$viewed_at', new Date(new Date().setDate(new Date().getDate() - 30))] }, 1, 0] } }
        }
      }
    ]).toArray();
    const stats: GameViewStats = {
      gameId,
      total_views: result.length > 0 ? result[0].total_views : 0,
      unique_views: result.length > 0 ? result[0].unique_views.length : 0,
      views_today: result.length > 0 ? result[0].views_today : 0,
      views_this_week: result.length > 0 ? result[0].views_this_week : 0,
      views_this_month: result.length > 0 ? result[0].views_this_month : 0,
    };
    return stats;
  }

  async getViewsForGames(gameIds: string[]): Promise<Record<string, GameViewStats>> {
    // if (gameIds.length === 0) return {};

    // const placeholders = gameIds.map(() => '?').join(',');
    // const result = await this.databaseService.read<GameViewStats>(
    //   `SELECT 
    //     game_id as gameId,
    //     COUNT(*) as total_views,
    //     COUNT(DISTINCT viewer_cookie) as unique_views,
    //     COUNT(CASE WHEN DATE(viewed_at) = CURDATE() THEN 1 END) as views_today,
    //     COUNT(CASE WHEN viewed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as views_this_week,
    //     COUNT(CASE WHEN viewed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as views_this_month
    //   FROM game_views 
    //   WHERE game_id IN (${placeholders})
    //   GROUP BY game_id`,
    //   gameIds
    // );

    // const stats: Record<string, GameViewStats> = {};
    // for (const row of result) {
    //   stats[row.gameId] = row;
    // }

    // for (const gameId of gameIds) {
    //   if (!stats[gameId]) {
    //     stats[gameId] = {
    //       gameId,
    //       total_views: 0,
    //       unique_views: 0,
    //       views_today: 0,
    //       views_this_week: 0,
    //       views_this_month: 0,
    //     };
    //   }
    // }

    // return stats;
    if (gameIds.length === 0) return {};

    // MongoDB query to get view stats for multiple games
    const db = await this.databaseService.getDb();
    const result = await db.collection('game_views').aggregate([
      { $match: { game_id: { $in: gameIds } } },
      {
        $group: {
          _id: '$game_id',
          total_views: { $sum: 1 },
          unique_views: { $addToSet: '$viewer_cookie' },
          views_today: { $sum: { $cond: [{ $eq: [{ $dateToString: { format: "%Y-%m-%d", date: "$viewed_at" } }, new Date().toISOString().split('T')[0]] }, 1, 0] } },
          views_this_week: {
            $sum: {
              $cond: [{ $gte: ['$viewed_at', new Date(new Date().setDate(new Date().getDate() - 7))] }, 1
                , 0]
            }
          },
          views_this_month: { $sum: { $cond: [{ $gte: ['$viewed_at', new Date(new Date().setDate(new Date().getDate() - 30))] }, 1, 0] } }
        }
      }
    ]).toArray();
    const stats: Record<string, GameViewStats> = {};
    for (const row of result) {
      stats[row._id] = {
        gameId: row._id,
        total_views: row.total_views,
        unique_views: row.unique_views.length,
        views_today: row.views_today,
        views_this_week: row.views_this_week,
        views_this_month: row.views_this_month,
      };
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
    // await this.databaseService.request('DELETE FROM game_views WHERE viewed_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [daysToKeep]);
    // MongoDB query to delete old views
    const db = await this.databaseService.getDb();
    await db.collection('game_views').deleteMany({ viewed_at: { $lt: new Date(new Date().setDate(new Date().getDate() - daysToKeep)) } });
  }
}
