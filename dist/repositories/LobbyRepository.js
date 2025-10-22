"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyRepository = void 0;
class LobbyRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getLobbies(filters = {}) {
        const query = 'SELECT lobbyId, users FROM lobbies WHERE 1=1';
        const rows = await this.databaseService.read(query);
        const lobbies = [];
        for (const row of rows) {
            if (filters.userId && row.users.indexOf(filters.userId) !== -1 && filters.userId) {
                const users = await this.getUsersByIds(row.users);
                lobbies.push({
                    lobbyId: row.lobbyId,
                    users,
                });
            }
            else if (filters.lobbyId && row.lobbyId === filters.lobbyId) {
                const users = await this.getUsersByIds(row.users);
                lobbies.push({
                    lobbyId: row.lobbyId,
                    users,
                });
            }
        }
        return lobbies;
    }
    async getLobby(lobbyId) {
        const lobbies = await this.getLobbies({ lobbyId });
        return lobbies[0] || null;
    }
    async getUserLobby(userId) {
        const lobbies = await this.getLobbies({ userId });
        if (lobbies.length === 0)
            return null;
        return lobbies ? { lobbyId: lobbies[0].lobbyId, users: lobbies[0].users } : null;
    }
    async getUserLobbies(userId) {
        return this.getLobbies({ userId });
    }
    async createLobby(lobbyId, users = []) {
        await this.databaseService.request('INSERT INTO lobbies (lobbyId, users) VALUES (?, ?)', [lobbyId, JSON.stringify(users)]);
    }
    async updateLobbyUsers(lobbyId, users) {
        const usersIds = await this.getUsersIdOnly(users);
        await this.databaseService.request('UPDATE lobbies SET users = ? WHERE lobbyId = ?', [JSON.stringify(usersIds), lobbyId]);
    }
    async deleteLobby(lobbyId) {
        await this.databaseService.request('DELETE FROM lobbies WHERE lobbyId = ?', [lobbyId]);
    }
    async getUsersByIds(userIds) {
        if (userIds.length === 0)
            return [];
        return await this.databaseService.read(`SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => '?').join(',')}) AND disabled = 0`, userIds);
    }
    async getUsersIdOnly(users) {
        return users.map(user => user.user_id);
    }
}
exports.LobbyRepository = LobbyRepository;
