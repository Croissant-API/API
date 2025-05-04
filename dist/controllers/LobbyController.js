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
exports.LobbyController = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const LobbyValidator_1 = require("../validators/LobbyValidator");
const yup_1 = require("yup");
const uuid_1 = require("uuid");
const describe_1 = require("../decorators/describe");
let LobbyController = class LobbyController {
    constructor(lobbyService) {
        this.lobbyService = lobbyService;
    }
    async getLobby(req, res) {
        try {
            await LobbyValidator_1.lobbyIdParamSchema.validate(req.params);
            const lobbyId = req.params.lobbyId;
            const lobby = await this.lobbyService.getLobby(lobbyId);
            if (!lobby) {
                return res.status(404).send({ message: "Lobby not found" });
            }
            res.send(lobby);
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching lobby", error: message });
        }
    }
    async joinLobby(req, res) {
        try {
            await LobbyValidator_1.lobbyIdParamSchema.validate(req.params);
            await LobbyValidator_1.userIdBodySchema.validate(req.body);
            const lobbyId = req.params.lobbyId;
            const { userId } = req.body;
            await this.lobbyService.joinLobby(lobbyId, userId);
            res.status(200).send({ message: "Joined lobby" });
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error joining lobby", error: message });
        }
    }
    async leaveLobby(req, res) {
        try {
            await LobbyValidator_1.lobbyIdParamSchema.validate(req.params);
            await LobbyValidator_1.userIdBodySchema.validate(req.body);
            const lobbyId = req.params.lobbyId;
            const { userId } = req.body;
            await this.lobbyService.leaveLobby(lobbyId, userId);
            res.status(200).send({ message: "Left lobby" });
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error leaving lobby", error: message });
        }
    }
    async getUserLobby(req, res) {
        try {
            await LobbyValidator_1.userIdParamSchema.validate(req.params);
            const { userId } = req.params;
            const lobby = await this.lobbyService.getUserLobby(userId);
            if (!lobby) {
                return res.status(404).send({ message: "User is not in any lobby" });
            }
            res.send(lobby);
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user lobby", error: message });
        }
    }
    async createLobby(req, res) {
        try {
            await LobbyValidator_1.createLobbyBodySchema.validate(req.body);
            const lobbyId = (0, uuid_1.v4)(); // Generate a new UUID for the lobbyId
            const { users } = req.body;
            await this.lobbyService.createLobby(lobbyId, users);
            res.status(201).send({ message: "Lobby created" });
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating lobby", error: message });
        }
    }
};
__decorate([
    (0, describe_1.describe)({
        endpoint: "/lobbies/:lobbyId",
        method: "GET",
        description: "Get a lobby by lobbyId",
        params: { lobbyId: "The id of the lobby" },
        responseType: "object{lobbyId: string, users: array[string]}",
        example: "GET /api/lobbies/123"
    }),
    (0, inversify_express_utils_1.httpGet)("/:lobbyId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LobbyController.prototype, "getLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/lobbies/:lobbyId/join",
        method: "POST",
        description: "Join a lobby",
        params: { lobbyId: "The id of the lobby" },
        body: { userId: "The id of the user joining the lobby" },
        responseType: "object{message: string}",
        example: "POST /api/lobbies/123/join {\"userId\": \"user_1\"}"
    }),
    (0, inversify_express_utils_1.httpPost)("/:lobbyId/join"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LobbyController.prototype, "joinLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/lobbies/:lobbyId/leave",
        method: "POST",
        description: "Leave a lobby",
        params: { lobbyId: "The id of the lobby" },
        body: { userId: "The id of the user leaving the lobby" },
        responseType: "object{message: string}",
        example: "POST /api/lobbies/123/leave {\"userId\": \"user_1\"}"
    }),
    (0, inversify_express_utils_1.httpPost)("/:lobbyId/leave"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LobbyController.prototype, "leaveLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/lobbies/user/:userId",
        method: "GET",
        description: "Get the lobby a user is in",
        params: { userId: "The id of the user" },
        responseType: "object{lobbyId: string, users: array[string]}",
        example: "GET /api/lobbies/user/123"
    }),
    (0, inversify_express_utils_1.httpGet)("/user/:userId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LobbyController.prototype, "getUserLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/lobbies",
        method: "POST",
        description: "Create a new lobby",
        body: { users: "Array of user IDs to add to the lobby" },
        responseType: "object{message: string}",
        example: "POST /api/lobbies {\"users\": [\"user_1\", \"user_2\"]}"
    }),
    (0, inversify_express_utils_1.httpPost)("/"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LobbyController.prototype, "createLobby", null);
LobbyController = __decorate([
    (0, inversify_express_utils_1.controller)("/lobbies"),
    __param(0, (0, inversify_1.inject)("LobbyService")),
    __metadata("design:paramtypes", [Object])
], LobbyController);
exports.LobbyController = LobbyController;
