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
exports.Lobbies = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const LobbyValidator_1 = require("../validators/LobbyValidator");
const yup_1 = require("yup");
const uuid_1 = require("uuid");
const describe_1 = require("../decorators/describe");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
async function validateOr400(schema, data, res) {
    try {
        await schema.validate(data);
        return true;
    }
    catch (error) {
        if (error instanceof yup_1.ValidationError) {
            res.status(400).send({ message: "Validation failed", errors: error.errors });
            return false;
        }
        throw error;
    }
}
let Lobbies = class Lobbies {
    constructor(lobbyService) {
        this.lobbyService = lobbyService;
    }
    // --- Création de lobby ---
    async createLobby(req, res) {
        try {
            const lobbyId = (0, uuid_1.v4)(); // Generate a new UUID for the lobbyId
            await this.lobbyService.createLobby(lobbyId, [req.user.user_id]);
            await this.lobbyService.joinLobby(lobbyId, req.user.user_id);
            res.status(201).send({ message: "Lobby created" });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error creating lobby", error: message });
        }
    }
    // --- Récupération d’un lobby ---
    async getLobby(req, res) {
        if (!(await validateOr400(LobbyValidator_1.lobbyIdParamSchema, req.params, res)))
            return;
        try {
            const lobbyId = req.params.lobbyId;
            const lobby = await this.lobbyService.getFormattedLobby(lobbyId);
            if (!lobby) {
                return res.status(404).send({ message: "Lobby not found" });
            }
            res.send(lobby);
        }
        catch (error) {
            handleError(res, error, "Error fetching lobby");
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
            handleError(res, error, "Error fetching user lobby");
        }
    }
    async getUserLobby(req, res) {
        if (!(await validateOr400(LobbyValidator_1.userIdParamSchema, req.params, res)))
            return;
        try {
            const { userId } = req.params;
            const lobby = await this.lobbyService.getUserLobby(userId);
            if (!lobby) {
                return res.status(404).send({ message: "User is not in any lobby" });
            }
            res.send(lobby);
        }
        catch (error) {
            handleError(res, error, "Error fetching user lobby");
        }
    }
    // --- Actions sur un lobby ---
    async joinLobby(req, res) {
        if (!(await validateOr400(LobbyValidator_1.lobbyIdParamSchema, req.params, res)))
            return;
        try {
            await this.lobbyService.joinLobby(req.params.lobbyId, req.user.user_id);
            res.status(200).send({ message: "Joined lobby" });
        }
        catch (error) {
            handleError(res, error, "Error joining lobby");
        }
    }
    async leaveLobby(req, res) {
        if (!(await validateOr400(LobbyValidator_1.lobbyIdParamSchema, req.params, res)))
            return;
        try {
            await this.lobbyService.leaveLobby(req.params.lobbyId, req.user.user_id);
            res.status(200).send({ message: "Left lobby" });
        }
        catch (error) {
            handleError(res, error, "Error leaving lobby");
        }
    }
};
__decorate([
    (0, describe_1.describe)({
        endpoint: "/lobbies",
        method: "POST",
        description: "Create a new lobby.",
        responseType: { message: "string" },
        example: "POST /api/lobbies",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)("/", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "createLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/lobbies/:lobbyId",
        method: "GET",
        description: "Get a lobby by lobbyId",
        params: { lobbyId: "The id of the lobby" },
        responseType: {
            lobbyId: "string",
            users: [{
                    username: "string",
                    user_id: "string",
                    verified: "boolean",
                    steam_username: "string",
                    steam_avatar_url: "string",
                    steam_id: "string"
                }]
        },
        example: "GET /api/lobbies/123",
    }),
    (0, inversify_express_utils_1.httpGet)("/:lobbyId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "getLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/lobbies/user/@me",
        method: "GET",
        description: "Get the lobby the authenticated user is in.",
        responseType: { lobbyId: "string", users: ["string"] },
        example: "GET /api/lobbies/user/@me",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpGet)("/user/@me", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "getMyLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/lobbies/user/:userId",
        method: "GET",
        description: "Get the lobby a user is in",
        params: { userId: "The id of the user" },
        responseType: { lobbyId: "string", users: ["string"] },
        example: "GET /api/lobbies/user/123",
    }),
    (0, inversify_express_utils_1.httpGet)("/user/:userId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "getUserLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/lobbies/:lobbyId/join",
        method: "POST",
        description: "Join a lobby.",
        params: { lobbyId: "The id of the lobby" },
        responseType: { message: "string" },
        example: "POST /api/lobbies/123/join",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)("/:lobbyId/join", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "joinLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/lobbies/:lobbyId/leave",
        method: "POST",
        description: "Leave a lobby.",
        params: { lobbyId: "The id of the lobby" },
        responseType: { message: "string" },
        example: "POST /api/lobbies/123/leave",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)("/:lobbyId/leave", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "leaveLobby", null);
Lobbies = __decorate([
    (0, inversify_express_utils_1.controller)("/lobbies"),
    __param(0, (0, inversify_1.inject)("LobbyService")),
    __metadata("design:paramtypes", [Object])
], Lobbies);
exports.Lobbies = Lobbies;
