"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioRepository = void 0;
class StudioRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getStudio(user_id) {
        const studiosResponse = await this.databaseService.read("SELECT * FROM studios WHERE user_id = ?", [user_id]);
        return studiosResponse.length === 0 ? null : studiosResponse[0];
    }
    async setStudioProperties(user_id, admin_id, userIds) {
        await this.databaseService.request("UPDATE studios SET admin_id = ?, users = ? WHERE user_id = ?", [admin_id, JSON.stringify(userIds), user_id]);
    }
    async getUserStudios(user_id) {
        const studios = await this.databaseService.read(`SELECT * FROM studios WHERE admin_id = ? OR users LIKE ?`, [
            user_id,
            `%"${user_id}"%`,
        ]);
        return studios.map(studio => ({
            ...studio,
            users: Array.isArray(studio.users) ? studio.users : JSON.parse(studio.users)
        }));
    }
    async createStudio(user_id, admin_id) {
        await this.databaseService.request("INSERT INTO studios (user_id, admin_id, users) VALUES (?, ?, ?)", [user_id, admin_id, JSON.stringify([])]);
    }
}
exports.StudioRepository = StudioRepository;
