"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyRepository = void 0;
class LobbyRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    // Méthode générique pour récupérer les lobbies selon des filtres
    async getLobbies(filters = {}, orderBy = "lobbyId ASC") {
        let query = "SELECT lobbyId, users FROM lobbies WHERE 1=1";
        const params = [];
        if (filters.lobbyId) {
            query += " AND lobbyId = ?";
            params.push(filters.lobbyId);
        }
        if (filters.userId) {
            query += " AND JSON_EXTRACT(users, '$') LIKE ?";
            params.push(`%"${filters.userId}%"`);
        }
        query += ` ORDER BY ${orderBy}`;
        const rows = await this.databaseService.read(query, params);
        // Parse users JSON for all lobbies
        const lobbies = [];
        for (const row of rows) {
            const users = await this.getUsersByIds(JSON.parse(row.users));
            lobbies.push({
                lobbyId: row.lobbyId,
                users
            });
        }
        return lobbies;
    }
    // Surcharges utilisant la méthode générique
    async getLobby(lobbyId) {
        const lobbies = await this.getLobbies({ lobbyId });
        return lobbies[0] || null;
    }
    async getUserLobby(userId) {
        const lobbies = await this.getLobbies({ userId });
        return lobbies ? { lobbyId: lobbies[0].lobbyId, users: lobbies[0].users } : null;
    }
    async getUserLobbies(userId) {
        return this.getLobbies({ userId });
    }
    async createLobby(lobbyId, users = []) {
        await this.databaseService.request("INSERT INTO lobbies (lobbyId, users) VALUES (?, ?)", [lobbyId, JSON.stringify(users)]);
    }
    async updateLobbyUsers(lobbyId, users) {
        const usersIds = await this.getUsersIdOnly(users);
        await this.databaseService.request("UPDATE lobbies SET users = ? WHERE lobbyId = ?", [JSON.stringify(usersIds), lobbyId]);
    }
    async deleteLobby(lobbyId) {
        await this.databaseService.request("DELETE FROM lobbies WHERE lobbyId = ?", [lobbyId]);
    }
    async getUsersByIds(userIds) {
        if (userIds.length === 0)
            return [];
        return await this.databaseService.read(`SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds
            .map(() => "?")
            .join(",")}) AND disabled = 0`, userIds);
    }
    async getUsersIdOnly(users) {
        return users.map(user => user.user_id);
    }
}
exports.LobbyRepository = LobbyRepository;
