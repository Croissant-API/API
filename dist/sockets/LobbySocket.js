"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbySocket = void 0;
const inversify_1 = require("inversify");
let LobbySocket = class LobbySocket {
    constructor(lobbyService, logService) {
        this.lobbyService = lobbyService;
        this.logService = logService;
    }
    initialize(io) {
        io.on('connection', (socket) => {
            console.log('Client connected to lobby socket:', socket.id);
            // Rejoindre une room de lobby
            socket.on('lobby:join', ({ lobbyId }) => {
                socket.join(lobbyId);
                console.log(`Socket ${socket.id} joined lobby room: ${lobbyId}`);
            });
            // Quitter une room de lobby
            socket.on('lobby:leave', ({ lobbyId }) => {
                socket.leave(lobbyId);
                console.log(`Socket ${socket.id} left lobby room: ${lobbyId}`);
            });
            // Créer un lobby
            socket.on('lobby:create', async ({ userId }, cb) => {
                try {
                    const { v4 } = await Promise.resolve().then(() => __importStar(require('uuid')));
                    const lobbyId = v4();
                    // Quitter tous les autres lobbies d'abord
                    await this.lobbyService.leaveAllLobbies(userId);
                    // Créer et rejoindre le nouveau lobby
                    await this.lobbyService.createLobby(lobbyId, [userId]);
                    const lobby = await this.lobbyService.getLobby(lobbyId);
                    // Faire rejoindre le socket à la room du lobby
                    socket.join(lobbyId);
                    // Notifier les autres clients
                    io.to(lobbyId).emit('lobby:created', lobby);
                    cb?.({ success: true, lobby });
                }
                catch (err) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error });
                }
            });
            // Rejoindre un lobby existant
            socket.on('lobby:joinLobby', async ({ lobbyId, userId }, cb) => {
                try {
                    // Quitter tous les autres lobbies d'abord
                    await this.lobbyService.leaveAllLobbies(userId);
                    // Rejoindre le lobby
                    await this.lobbyService.joinLobby(lobbyId, userId);
                    const updatedLobby = await this.lobbyService.getLobby(lobbyId);
                    // Faire rejoindre le socket à la room du lobby
                    socket.join(lobbyId);
                    // Notifier tous les clients dans ce lobby
                    io.to(lobbyId).emit('lobby:updated', updatedLobby);
                    cb?.({ success: true, message: 'Joined lobby successfully' });
                }
                catch (err) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error });
                }
            });
            // Quitter un lobby
            socket.on('lobby:leaveLobby', async ({ lobbyId, userId }, cb) => {
                try {
                    await this.lobbyService.leaveLobby(lobbyId, userId);
                    // Quitter la room socket
                    socket.leave(lobbyId);
                    // Vérifier si le lobby existe encore
                    const updatedLobby = await this.lobbyService.getLobby(lobbyId);
                    if (updatedLobby) {
                        // Notifier les autres membres du lobby
                        io.to(lobbyId).emit('lobby:updated', updatedLobby);
                    }
                    else {
                        // Le lobby a été supprimé (plus de membres)
                        io.to(lobbyId).emit('lobby:deleted', { lobbyId });
                    }
                    cb?.({ success: true, message: 'Left lobby successfully' });
                }
                catch (err) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error });
                }
            });
            // Obtenir les détails d'un lobby
            socket.on('lobby:get', async ({ lobbyId }, cb) => {
                try {
                    const lobby = await this.lobbyService.getLobby(lobbyId);
                    if (!lobby) {
                        cb?.({ success: false, error: 'Lobby not found' });
                        return;
                    }
                    cb?.({ success: true, lobby });
                }
                catch (err) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error });
                }
            });
            // Obtenir le lobby d'un utilisateur
            socket.on('lobby:getUserLobby', async ({ userId }, cb) => {
                try {
                    const lobby = await this.lobbyService.getUserLobby(userId);
                    cb?.({ success: true, lobby });
                }
                catch (err) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error });
                }
            });
            socket.on('disconnect', () => {
                console.log('Client disconnected from lobby socket:', socket.id);
            });
        });
    }
};
exports.LobbySocket = LobbySocket;
exports.LobbySocket = LobbySocket = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)('LobbyService')),
    __param(1, (0, inversify_1.inject)('LogService')),
    __metadata("design:paramtypes", [Object, Object])
], LobbySocket);
