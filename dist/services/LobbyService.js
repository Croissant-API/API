"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyService = void 0;
const inversify_1 = require("inversify");
const LobbyRepository_1 = require("../repositories/LobbyRepository");
let LobbyService = class LobbyService {
    constructor(databaseService, userService) {
        this.databaseService = databaseService;
        this.userService = userService;
        this.lobbyRepository = new LobbyRepository_1.LobbyRepository(this.databaseService);
    }
    async getLobby(lobbyId) {
        const lobby = await this.lobbyRepository.getLobby(lobbyId);
        if (!lobby)
            return null;
        return lobby;
    }
    async joinLobby(lobbyId, userId) {
        const lobby = await this.getLobby(lobbyId);
        const user = await this.userService.getUser(userId);
        if (!lobby)
            throw new Error('Lobby not found');
        if (!user)
            throw new Error('User not found');
        const users = [...new Set([...lobby.users, user])];
        await this.lobbyRepository.updateLobbyUsers(lobbyId, users);
    }
    async leaveLobby(lobbyId, userId) {
        const lobby = await this.getLobby(lobbyId);
        if (!lobby)
            throw new Error('Lobby not found');
        const newUsers = lobby.users.filter(u => u.user_id !== userId);
        if (newUsers.length === 0) {
            // await this.deleteLobby(lobbyId);
        }
        else {
            await this.lobbyRepository.updateLobbyUsers(lobbyId, newUsers);
        }
    }
    async getUserLobby(userId) {
        const lobby = await this.lobbyRepository.getUserLobby(userId);
        if (!lobby)
            return null;
        return lobby;
    }
    async createLobby(lobbyId, users = []) {
        await this.lobbyRepository.createLobby(lobbyId, users);
    }
    async deleteLobby(lobbyId) {
        await this.lobbyRepository.deleteLobby(lobbyId);
    }
    async getUserLobbies(userId) {
        const lobbies = await this.lobbyRepository.getUserLobbies(userId);
        return Promise.all(lobbies.map(async (lobby) => {
            return lobby;
        }));
    }
    async leaveAllLobbies(userId) {
        const lobbies = await this.getUserLobbies(userId);
        for (const lobby of lobbies) {
            await this.leaveLobby(lobby.lobbyId, userId);
        }
    }
};
exports.LobbyService = LobbyService;
exports.LobbyService = LobbyService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)('DatabaseService')),
    __param(1, (0, inversify_1.inject)('UserService'))
], LobbyService);
