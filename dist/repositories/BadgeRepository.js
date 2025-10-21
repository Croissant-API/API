"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadgeRepository = void 0;
class BadgeRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getBadgeTypes() {
        const result = await this.databaseService.read('SELECT * FROM badge_types ORDER BY id');
        return result;
    }
    async getActiveBadgesForGame(gameId) {
        const result = await this.databaseService.read(`SELECT 
        b.id, b.name, b.display_name, b.color, b.icon, gb.expires_at
      FROM game_badges gb
      JOIN badge_types b ON gb.badge_id = b.id
      WHERE gb.game_id = ? AND gb.expires_at > datetime('now')
      ORDER BY gb.created_at DESC`, [gameId]);
        return result;
    }
    async addBadgeToGame(gameId, badgeId, durationDays) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);
        await this.databaseService.request(`INSERT INTO game_badges (game_id, badge_id, created_at, expires_at)
       VALUES (?, ?, datetime('now'), ?)
       ON CONFLICT (game_id, badge_id) DO UPDATE SET 
       created_at = datetime('now'), expires_at = ?`, [gameId, badgeId, expiresAt, expiresAt]);
    }
    async removeExpiredBadges() {
        await this.databaseService.request('DELETE FROM game_badges WHERE expires_at < datetime("now")');
    }
    async getBadgeTypeByName(name) {
        const result = await this.databaseService.read('SELECT * FROM badge_types WHERE name = ?', [name]);
        return result.length > 0 ? result[0] : null;
    }
}
exports.BadgeRepository = BadgeRepository;
