"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameViewRepository = void 0;
class GameViewRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async addView(gameId, viewerCookie, ipAddress, userAgent) {
        await this.databaseService.request(`INSERT INTO game_views (game_id, viewer_cookie, ip_address, viewed_at, user_agent)
       VALUES (?, ?, ?, datetime('now'), ?)`, [gameId, viewerCookie, ipAddress, userAgent || null]);
    }
    async hasViewedToday(gameId, viewerCookie) {
        const result = await this.databaseService.read(`SELECT COUNT(*) as count FROM game_views 
       WHERE game_id = ? AND viewer_cookie = ? 
       AND date(viewed_at) = date('now')`, [gameId, viewerCookie]);
        return result.length > 0 && result[0].count > 0;
    }
    async getGameViewStats(gameId) {
        const result = await this.databaseService.read(`SELECT 
        ? as gameId,
        COUNT(*) as total_views,
        COUNT(DISTINCT viewer_cookie) as unique_views,
        COUNT(CASE WHEN date(viewed_at) = date('now') THEN 1 END) as views_today,
        COUNT(CASE WHEN viewed_at >= datetime('now', '-7 days') THEN 1 END) as views_this_week,
        COUNT(CASE WHEN viewed_at >= datetime('now', '-30 days') THEN 1 END) as views_this_month
      FROM game_views 
      WHERE game_id = ?`, [gameId, gameId]);
        return result.length > 0 ? result[0] : { gameId, total_views: 0, unique_views: 0, views_today: 0, views_this_week: 0, views_this_month: 0 };
    }
    async getViewsForGames(gameIds) {
        if (gameIds.length === 0)
            return {};
        const placeholders = gameIds.map(() => '?').join(',');
        const result = await this.databaseService.read(`SELECT 
        game_id as gameId,
        COUNT(*) as total_views,
        COUNT(DISTINCT viewer_cookie) as unique_views,
        COUNT(CASE WHEN date(viewed_at) = date('now') THEN 1 END) as views_today,
        COUNT(CASE WHEN viewed_at >= datetime('now', '-7 days') THEN 1 END) as views_this_week,
        COUNT(CASE WHEN viewed_at >= datetime('now', '-30 days') THEN 1 END) as views_this_month
      FROM game_views 
      WHERE game_id IN (${placeholders})
      GROUP BY game_id`, gameIds);
        const stats = {};
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
    async cleanupOldViews(daysToKeep = 365) {
        await this.databaseService.request('DELETE FROM game_views WHERE viewed_at < datetime("now", "-" || ? || " days")', [daysToKeep]);
    }
}
exports.GameViewRepository = GameViewRepository;
