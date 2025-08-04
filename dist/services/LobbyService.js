"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyService = void 0;
const inversify_1 = require("inversify");
let LobbyService = class LobbyService {
    constructor(databaseService, userService) {
        this.databaseService = databaseService;
        this.userService = userService;
    }
    async getLobby(lobbyId) {
        const lobby = await this.databaseService.read("SELECT lobbyId, users FROM lobbies WHERE lobbyId = ?", [lobbyId]);
        if (lobby.length === 0)
            return null;
        const userIds = lobby[0].users;
        const users = await this.getUsersByIds(userIds);
        return { lobbyId: lobby[0].lobbyId, users };
    }
    async joinLobby(lobbyId, userId) {
        const lobby = await this.getLobby(lobbyId);
        if (!lobby)
            throw new Error("Lobby not found");
        const users = [...new Set([...lobby.users, userId])];
        await this.databaseService.update("UPDATE lobbies SET users = ? WHERE lobbyId = ?", [JSON.stringify(users), lobbyId]);
    }
    async leaveLobby(lobbyId, userId) {
        const lobby = await this.getLobby(lobbyId);
        if (!lobby)
            throw new Error("Lobby not found");
        const newUsers = lobby.users.filter((u) => u.user_id !== userId);
        if (newUsers.length === 0) {
            await this.deleteLobby(lobbyId);
        }
        else {
            await this.databaseService.update("UPDATE lobbies SET users = ? WHERE lobbyId = ?", [JSON.stringify(newUsers), lobbyId]);
        }
    }
    async getUserLobby(userId) {
        const lobbies = await this.databaseService.read("SELECT lobbyId, users FROM lobbies WHERE JSON_EXTRACT(users, '$') LIKE ?", [`%"${userId}"%`]);
        if (lobbies.length === 0)
            return null;
        const lobby = lobbies[0];
        const userIds = lobby.users;
        const users = await this.getUsersByIds(userIds);
        return { lobbyId: lobby.lobbyId, users };
    }
    async createLobby(lobbyId, users = []) {
        await this.databaseService.update("INSERT INTO lobbies (lobbyId, users) VALUES (?, ?)", [lobbyId, JSON.stringify(users)]);
    }
    async deleteLobby(lobbyId) {
        await this.databaseService.update("DELETE FROM lobbies WHERE lobbyId = ?", [
            lobbyId,
        ]);
    }
    async getUserLobbies(userId) {
        const lobbies = await this.databaseService.read("SELECT lobbyId, users FROM lobbies WHERE JSON_EXTRACT(users, '$') LIKE ?", [`%"${userId}"%`]);
        return Promise.all(lobbies.map(async (lobby) => {
            const userIds = lobby.users;
            const users = await this.getUsersByIds(userIds);
            return { lobbyId: lobby.lobbyId, users };
        }));
    }
    async leaveAllLobbies(userId) {
        const lobbies = await this.getUserLobbies(userId);
        for (const lobby of lobbies) {
            await this.leaveLobby(lobby.lobbyId, userId);
        }
    }
    async getUsersByIds(userIds) {
        if (userIds.length === 0)
            return [];
        return await this.databaseService.read(`SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds
            .map(() => "?")
            .join(",")})`, userIds);
    }
};
exports.LobbyService = LobbyService;
exports.LobbyService = LobbyService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __param(1, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object, Object])
], LobbyService);
