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
// Utilitaire pour filtrer les champs selon l'utilisateur
function filterGame(game, userId) {
    const { owner_id, download_link, ...rest } = game;
    return {
        ...rest,
        ...(userId && owner_id === userId ? { download_link } : {}),
    };
}
let Games = class Games {
    constructor(gameService, userService) {
        this.gameService = gameService;
        this.userService = userService;
    }
    async listGames(req, res) {
        try {
            const games = await this.gameService.listGames();
            const filteredGames = games.map(game => filterGame(game));
            res.send(filteredGames);
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error listing games", error: message });
        }
    }
    async getUserGames(req, res) {
        try {
            const userId = req.user.user_id;
            const games = await this.gameService.getUserGames(userId);
            const filteredGames = games.map(game => filterGame(game, userId));
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
            const filteredGames = games.map(game => filterGame(game, userId));
            res.send(filteredGames);
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user games", error: message });
        }
    }
    async getGame(req, res) {
        try {
            await GameValidator_1.gameIdParamSchema.validate(req.params);
            const { gameId } = req.params;
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                return res.status(404).send({ message: "Game not found" });
            }
            res.send(filterGame(game));
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching game", error: message });
        }
    }
    async createGame(req, res) {
        try {
            await GameValidator_1.createGameBodySchema.validate(req.body);
            const { name, description, price, download_link, showInStore, iconHash, splashHash, bannerHash, genre, release_date, developer, publisher, platforms, rating, website, trailer_link, multiplayer } = req.body;
            const gameId = (0, uuid_1.v4)();
            const ownerId = req.user.user_id;
            await this.gameService.createGame({
                gameId,
                name,
                description,
                price,
                download_link: download_link ?? null,
                showInStore: showInStore ?? false,
                owner_id: ownerId,
                iconHash: iconHash ?? null,
                splashHash: splashHash ?? null,
                bannerHash: bannerHash ?? null,
                genre: genre ?? null,
                release_date: release_date ?? null,
                developer: developer ?? null,
                publisher: publisher ?? null,
                platforms: platforms ?? null,
                rating: rating ?? 0,
                website: website ?? null,
                trailer_link: trailer_link ?? null,
                multiplayer: multiplayer ?? false
            });
            const game = await this.gameService.getGame(gameId);
            res.status(201).send({ message: "Game created", game: game });
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating game", error: message });
        }
    }
    async updateGame(req, res) {
        try {
            await GameValidator_1.gameIdParamSchema.validate(req.params);
            await GameValidator_1.updateGameBodySchema.validate(req.body);
            const { gameId } = req.params;
            await this.gameService.updateGame(gameId, req.body);
            const updatedGame = await this.gameService.getGame(gameId);
            res.status(200).send(filterGame(updatedGame, req.user.user_id));
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error updating game", error: message });
        }
    }
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
    async buyGame(req, res) {
        const { gameId } = req.params;
        const userId = req.user.user_id;
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                return res.status(404).send({ message: "Game not found" });
            }
            if (game.owner_id === userId) {
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
