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
    constructor(gameService, userService) {
        this.gameService = gameService;
        this.userService = userService;
    }
    // Publique : liste tous les jeux
    async listGames(req, res) {
        try {
            const games = await this.gameService.listGames();
            const filteredGames = games.map((game) => {
                return {
                    gameId: game.gameId,
                    name: game.name,
                    description: game.description,
                    price: game.price,
                    ownerId: game.ownerId
                };
            });
            res.send(filteredGames);
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
            const filteredGames = games.map((game) => {
                return {
                    gameId: game.gameId,
                    name: game.name,
                    description: game.description,
                    price: game.price,
                    ownerId: game.ownerId,
                    download_link: game.download_link
                };
            });
            res.send(filteredGames);
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
            const filteredGames = games.map((game) => {
                return {
                    gameId: game.gameId,
                    name: game.name,
                    description: game.description,
                    price: game.price,
                    ownerId: game.ownerId
                };
            });
            res.send(filteredGames);
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
            const filteredGame = {
                gameId: game.gameId,
                name: game.name,
                description: game.description,
                price: game.price,
                ownerId: game.ownerId
            };
            res.send(filteredGame);
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
            const { name, description, price, downloadLink, image, showInStore } = req.body;
            const gameId = (0, uuid_1.v4)();
            const ownerId = req.user.user_id;
            await this.gameService.createGame({
                gameId,
                name,
                description,
                price,
                download_link: downloadLink,
                image,
                showInStore: showInStore || false,
                ownerId
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
    // Interne : acheter un jeu (buy)
    async buyGame(req, res) {
        const { gameId } = req.params;
        const userId = req.user.user_id;
        try {
            // L'utilisateur ne peut pas revendre le jeu, donc on ne retire jamais un owner
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                return res.status(404).send({ message: "Game not found" });
            }
            if (game.ownerId === userId) {
                await this.gameService.addOwner(gameId, userId);
                res.status(200).send({ message: "Game obtained" });
            }
            else {
                const user = await this.userService.getUser(userId);
                if (!user) {
                    return res.status(404).send({ message: "User not found" });
                }
                if (user.balance < game.price) {
                    return res.status(400).send({ message: "Not enough balance" });
                }
                await this.userService.updateUserBalance(userId, user.balance - game.price);
                await this.gameService.addOwner(gameId, userId);
                res.status(200).send({ message: "Game purchased" });
            }
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error purchasing game", error: message });
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
    (0, inversify_express_utils_1.httpPost)("/:gameId/buy", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "buyGame", null);
Games = __decorate([
    (0, inversify_express_utils_1.controller)("/games"),
    __param(0, (0, inversify_1.inject)("GameService")),
    __param(1, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object, Object])
], Games);
exports.Games = Games;
