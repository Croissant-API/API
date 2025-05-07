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
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getLobby(lobbyId) {
        const rows = await this.databaseService.read("SELECT users FROM lobbies WHERE lobbyId = ?", [lobbyId]);
        if (rows.length === 0)
            return null;
        const row = rows[0];
        return row;
    }
    async joinLobby(lobbyId, userId) {
        const lobby = await this.getLobby(lobbyId);
        if (!lobby)
            throw new Error("Lobby not found");
        const users = JSON.parse(lobby.users);
        users.push(userId);
        const uniqueUsers = [...new Set(users)];
        await this.databaseService.update("UPDATE lobbies SET users = ? WHERE lobbyId = ?", [JSON.stringify(uniqueUsers), lobbyId]);
    }
    async leaveLobby(lobbyId, userId) {
        const lobby = await this.getLobby(lobbyId);
        console.log(lobby);
        if (!lobby)
            throw new Error("Lobby not found");
        const newUsers = JSON.parse(lobby.users).filter((u) => u !== userId);
        if (newUsers.length === 0) {
            await this.deleteLobby(lobbyId);
        }
        else {
            await this.databaseService.update("UPDATE lobbies SET users = ? WHERE lobbyId = ?", [JSON.stringify(newUsers), lobbyId]);
        }
    }
    async getUserLobby(userId) {
        const rows = await this.databaseService.read("SELECT lobbyId, users FROM lobbies");
        for (const row of rows) {
            const users = JSON.parse(row.users);
            if (users.includes(userId)) {
                return { lobbyId: row.lobbyId, users: row.users };
            }
        }
        return null;
    }
    async createLobby(lobbyId, users = []) {
        await this.databaseService.update("INSERT INTO lobbies (lobbyId, users) VALUES (?, ?)", [lobbyId, JSON.stringify(users)]);
    }
    async deleteLobby(lobbyId) {
        await this.databaseService.update("DELETE FROM lobbies WHERE lobbyId = ?", [lobbyId]);
    }
};
LobbyService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], LobbyService);
exports.LobbyService = LobbyService;
