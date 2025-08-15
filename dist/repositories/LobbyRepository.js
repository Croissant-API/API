"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyRepository = void 0;
class LobbyRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getLobby(lobbyId) {
        const lobby = await this.databaseService.read("SELECT lobbyId, users FROM lobbies WHERE lobbyId = ?", [lobbyId]);
        return lobby.length === 0 ? null : lobby[0];
    }
    async updateLobbyUsers(lobbyId, users) {
        await this.databaseService.request("UPDATE lobbies SET users = ? WHERE lobbyId = ?", [JSON.stringify(users), lobbyId]);
    }
    async getUserLobby(userId) {
        const lobbies = await this.databaseService.read("SELECT lobbyId, users FROM lobbies WHERE JSON_EXTRACT(users, '$') LIKE ?", [`%"${userId}%"`]);
        return lobbies.length === 0 ? null : lobbies[0];
    }
    async createLobby(lobbyId, users = []) {
        await this.databaseService.request("INSERT INTO lobbies (lobbyId, users) VALUES (?, ?)", [lobbyId, JSON.stringify(users)]);
    }
    async deleteLobby(lobbyId) {
        await this.databaseService.request("DELETE FROM lobbies WHERE lobbyId = ?", [lobbyId]);
    }
    async getUserLobbies(userId) {
        return await this.databaseService.read("SELECT lobbyId, users FROM lobbies WHERE JSON_EXTRACT(users, '$') LIKE ?", [`%"${userId}%"`]);
    }
}
exports.LobbyRepository = LobbyRepository;
