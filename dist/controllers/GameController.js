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
exports.Games = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const yup_1 = require("yup");
const GameValidator_1 = require("../validators/GameValidator");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const uuid_1 = require("uuid");
const describe_1 = require("../decorators/describe");
let Games = class Games {
    constructor(gameService) {
        this.gameService = gameService;
    }
    // Publique : liste tous les jeux
    async listGames(req, res) {
        try {
            const games = await this.gameService.listGames();
            res.send(games);
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error listing games", error: message });
        }
    }
    async getUserGames(req, res) {
        try {
            const userId = req.user.user_id; // Assuming req.user is set by the LoggedCheck middleware
            const games = await this.gameService.getUserGames(userId);
            res.send(games);
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user games", error: message });
        }
    }
    async getGamesByUserId(req, res) {
        try {
            const { userId } = req.params;
            const games = await this.gameService.getUserGames(userId);
            res.send(games);
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user games", error: message });
        }
    }
    // Publique : détail d'un jeu
    async getGame(req, res) {
        try {
            await GameValidator_1.gameIdParamSchema.validate(req.params);
            const { gameId } = req.params;
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                return res.status(404).send({ message: "Game not found" });
            }
            res.send(game);
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching game", error: message });
        }
    }
    // Interne : création d'un jeu (authentifié)
    async createGame(req, res) {
        try {
            await GameValidator_1.createGameBodySchema.validate(req.body);
            const { name, description, price, showInStore } = req.body;
            const gameId = (0, uuid_1.v4)(); // Generate a new UUID for the gameId
            const ownerId = req.user.user_id; // Assuming req.user is set by the LoggedCheck middleware
            await this.gameService.createGame({
                gameId,
                name,
                description,
                price,
                ownerId,
                showInStore
            });
            res.status(201).send({ message: "Game created" });
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating game", error: message });
        }
    }
    // Interne : update d'un jeu (authentifié)
    async updateGame(req, res) {
        try {
            await GameValidator_1.gameIdParamSchema.validate(req.params);
            await GameValidator_1.updateGameBodySchema.validate(req.body);
            const { gameId } = req.params;
            await this.gameService.updateGame(gameId, req.body);
            res.status(200).send({ message: "Game updated" });
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error updating game", error: message });
        }
    }
    // Interne : suppression d'un jeu (authentifié)
    async deleteGame(req, res) {
        try {
            await GameValidator_1.gameIdParamSchema.validate(req.params);
            const { gameId } = req.params;
            await this.gameService.deleteGame(gameId);
            res.status(200).send({ message: "Game deleted" });
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error deleting game", error: message });
        }
    }
    // Interne : ajouter un owner secondaire
    async addOwner(req, res) {
        const { gameId } = req.params;
        const { ownerId } = req.body;
        if (!ownerId)
            return res.status(400).send({ message: "Missing ownerId" });
        try {
            await this.gameService.addOwner(gameId, ownerId);
            res.status(200).send({ message: "Owner added" });
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error adding owner", error: message });
        }
    }
    // Interne : retirer un owner secondaire
    async removeOwner(req, res) {
        const { gameId, ownerId } = req.params;
        try {
            await this.gameService.removeOwner(gameId, ownerId);
            res.status(200).send({ message: "Owner removed" });
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error removing owner", error: message });
        }
    }
};
__decorate([
    (0, describe_1.describe)({
        endpoint: "/games",
        method: "GET",
        description: "List all games",
        responseType: "array[object{gameId: string, name: string, description: string, price: number, owner_id: string, showInStore: boolean, owners: array[string]}]",
        example: "GET /api/games"
    }),
    (0, inversify_express_utils_1.httpGet)("/"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "listGames", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/list/@me", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "getUserGames", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/games/list/:userId",
        method: "GET",
        description: "List all games owned by a specific user",
        params: { userId: "The id of the user" },
        responseType: "array[object{gameId: string, name: string, description: string, price: number, owner_id: string, showInStore: boolean, owners: array[string]}]",
        example: "GET /api/games/list/123"
    }),
    (0, inversify_express_utils_1.httpGet)("/list/:userId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "getGamesByUserId", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/games/:gameId",
        method: "GET",
        description: "Get a game by gameId",
        params: { gameId: "The id of the game" },
        responseType: "object{gameId: string, name: string, description: string, price: number, owner_id: string, showInStore: boolean, owners: array[string]}",
        example: "GET /api/games/123"
    }),
    (0, inversify_express_utils_1.httpGet)("/:gameId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "getGame", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "createGame", null);
__decorate([
    (0, inversify_express_utils_1.httpPut)("/:gameId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "updateGame", null);
__decorate([
    (0, inversify_express_utils_1.httpDelete)("/:gameId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "deleteGame", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/:gameId/owners", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "addOwner", null);
__decorate([
    (0, inversify_express_utils_1.httpDelete)("/:gameId/owners/:ownerId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "removeOwner", null);
Games = __decorate([
    (0, inversify_express_utils_1.controller)("/games"),
    __param(0, (0, inversify_1.inject)("GameService")),
    __metadata("design:paramtypes", [Object])
], Games);
exports.Games = Games;
