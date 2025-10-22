"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioRepository = void 0;
class StudioRepository {
    constructor(db) {
        this.db = db;
    }
    parseUsers(users) {
        return Array.isArray(users) ? users : JSON.parse(users);
    }
    async getStudio(user_id) {
        const res = await this.db.read('SELECT * FROM studios WHERE user_id = ?', [user_id]);
        return res[0] ?? null;
    }
    async setStudioProperties(user_id, admin_id, userIds) {
        await this.db.request('UPDATE studios SET admin_id = ?, users = ? WHERE user_id = ?', [admin_id, JSON.stringify(userIds), user_id]);
    }
    async getUserStudios(user_id) {
        const studios = await this.db.read('SELECT * FROM studios WHERE admin_id = ? OR users LIKE ?', [user_id, `%"${user_id}"%`]);
        return studios.map(s => ({ ...s, users: this.parseUsers(s.users) }));
    }
    async createStudio(user_id, admin_id) {
        await this.db.request('INSERT INTO studios (user_id, admin_id, users) VALUES (?, ?, ?)', [user_id, admin_id, JSON.stringify([])]);
    }
}
exports.StudioRepository = StudioRepository;
