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
import { inject } from 'inversify';
import { controller, httpGet, httpPost } from "inversify-express-utils";
import { lobbyIdParamSchema, userIdParamSchema } from '../validators/LobbyValidator';
import { ValidationError } from 'yup';
import { v4 } from 'uuid';
import { describe } from '../decorators/describe';
import { LoggedCheck } from '../middlewares/LoggedCheck';
let Lobbies = class Lobbies {
    constructor(lobbyService) {
        this.lobbyService = lobbyService;
    }
    async getLobby(req, res) {
        try {
            await lobbyIdParamSchema.validate(req.params);
            const lobbyId = req.params.lobbyId;
            const lobby = await this.lobbyService.getLobby(lobbyId);
            if (!lobby) {
                return res.status(404).send({ message: "Lobby not found" });
            }
            res.send(lobby);
        }
        catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching lobby", error: message });
        }
    }
    async joinLobby(req, res) {
        try {
            await lobbyIdParamSchema.validate(req.params);
            const lobbyId = req.params.lobbyId;
            await this.lobbyService.joinLobby(lobbyId, req.user.user_id);
            res.status(200).send({ message: "Joined lobby" });
        }
        catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error joining lobby", error: message });
        }
    }
    async leaveLobby(req, res) {
        try {
            await lobbyIdParamSchema.validate(req.params);
            const lobbyId = req.params.lobbyId;
            await this.lobbyService.leaveLobby(lobbyId, req.user.user_id);
            res.status(200).send({ message: "Left lobby" });
        }
        catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error leaving lobby", error: message });
        }
    }
    async getMyLobby(req, res) {
        try {
            const userId = req.user.user_id;
            const lobby = await this.lobbyService.getUserLobby(userId);
            if (!lobby) {
                return res.status(404).send({ message: "User is not in any lobby" });
            }
            res.send(lobby);
        }
        catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user lobby", error: message });
        }
    }
    async getUserLobby(req, res) {
        try {
            await userIdParamSchema.validate(req.params);
            const { userId } = req.params;
            const lobby = await this.lobbyService.getUserLobby(userId);
            if (!lobby) {
                return res.status(404).send({ message: "User is not in any lobby" });
            }
            res.send(lobby);
        }
        catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user lobby", error: message });
        }
    }
    async createLobby(req, res) {
        try {
            const lobbyId = v4(); // Generate a new UUID for the lobbyId
            await this.lobbyService.createLobby(lobbyId, [req.user.user_id]);
            await this.lobbyService.joinLobby(lobbyId, req.user.user_id);
            res.status(201).send({ message: "Lobby created" });
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating lobby", error: message });
        }
    }
};
__decorate([
    describe({
        endpoint: "/lobbies/:lobbyId",
        method: "GET",
        description: "Get a lobby by lobbyId",
        params: { lobbyId: "The id of the lobby" },
        responseType: "object{lobbyId: string, users: array[string]}",
        example: "GET /api/lobbies/123"
    }),
    httpGet("/:lobbyId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "getLobby", null);
__decorate([
    describe({
        endpoint: "/lobbies/:lobbyId/join",
        method: "POST",
        description: "Join a lobby. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { lobbyId: "The id of the lobby" },
        responseType: "object{message: string}",
        example: "POST /api/lobbies/123/join"
    }),
    httpPost("/:lobbyId/join", LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "joinLobby", null);
__decorate([
    describe({
        endpoint: "/lobbies/:lobbyId/leave",
        method: "POST",
        description: "Leave a lobby. Requires authentication via header \"Authorization: Bearer <token>\".",
        params: { lobbyId: "The id of the lobby" },
        responseType: "object{message: string}",
        example: "POST /api/lobbies/123/leave"
    }),
    httpPost("/:lobbyId/leave", LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "leaveLobby", null);
__decorate([
    describe({
        endpoint: "/lobbies/user/@me",
        method: "GET",
        description: "Get the lobby the authenticated user is in. Requires authentication via header \"Authorization: Bearer <token>\".",
        responseType: "object{lobbyId: string, users: array[string]}",
        example: "GET /api/lobbies/user/@me"
    }),
    httpGet("/user/@me", LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "getMyLobby", null);
__decorate([
    describe({
        endpoint: "/lobbies/user/:userId",
        method: "GET",
        description: "Get the lobby a user is in",
        params: { userId: "The id of the user" },
        responseType: "object{lobbyId: string, users: array[string]}",
        example: "GET /api/lobbies/user/123"
    }),
    httpGet("/user/:userId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "getUserLobby", null);
__decorate([
    describe({
        endpoint: "/lobbies",
        method: "POST",
        description: "Create a new lobby. Requires authentication via header \"Authorization: Bearer <token>\".",
        responseType: "object{message: string}",
        example: "POST /api/lobbies"
    }),
    httpPost("/", LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "createLobby", null);
Lobbies = __decorate([
    controller("/lobbies"),
    __param(0, inject("LobbyService")),
    __metadata("design:paramtypes", [Object])
], Lobbies);
export { Lobbies };
