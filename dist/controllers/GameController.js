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
// Utility to filter game fields based on the user
function filterGame(game, userId) {
    return {
        gameId: game.gameId,
        name: game.name,
        description: game.description,
        price: game.price,
        owner_id: game.owner_id,
        showInStore: game.showInStore,
        iconHash: game.iconHash,
        splashHash: game.splashHash,
        bannerHash: game.bannerHash,
        genre: game.genre,
        release_date: game.release_date,
        developer: game.developer,
        publisher: game.publisher,
        platforms: game.platforms,
        rating: game.rating,
        website: game.website,
        trailer_link: game.trailer_link,
        multiplayer: game.multiplayer,
        ...(userId && game.owner_id === userId
            ? { download_link: game.download_link }
            : {}),
    };
}
// --- UTILS ---
const gameResponseFields = {
    gameId: "string",
    name: "string",
    description: "string",
    price: "number",
    owner_id: "string",
    showInStore: "boolean",
    iconHash: "string",
    splashHash: "string",
    bannerHash: "string",
    genre: "string",
    release_date: "string",
    developer: "string",
    publisher: "string",
    platforms: ["string"],
    rating: "number",
    website: "string",
    trailer_link: "string",
    multiplayer: "boolean",
};
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
let Games = class Games {
    constructor(gameService, userService) {
        this.gameService = gameService;
        this.userService = userService;
    }
    // --- LISTING & SEARCH ---
    async listGames(req, res) {
        try {
            const games = await this.gameService.listGames();
            res.send(games.filter(g => g.showInStore).map(g => filterGame(g)));
        }
        catch (error) {
            handleError(res, error, "Error listing games");
        }
    }
    async searchGames(req, res) {
        const query = req.query.q?.trim();
        if (!query)
            return res.status(400).send({ message: "Missing search query" });
        try {
            const games = await this.gameService.listGames();
            res.send(games.filter(g => g.showInStore && [g.name, g.description, g.genre].some(v => v && v.toLowerCase().includes(query.toLowerCase()))).map(g => filterGame(g)));
        }
        catch (error) {
            handleError(res, error, "Error searching games");
        }
    }
    async getMyCreatedGames(req, res) {
        try {
            const userId = req.user.user_id;
            const games = await this.gameService.listGames();
            res.send(games.filter(g => g.owner_id === userId).map(g => filterGame(g, userId)));
        }
        catch (error) {
            handleError(res, error, "Error fetching your created games");
        }
    }
    async getUserGames(req, res) {
        try {
            res.send(await this.gameService.getUserGames(req.user.user_id));
        }
        catch (error) {
            handleError(res, error, "Error fetching user games");
        }
    }
    async getGame(req, res) {
        if (!(await validateOr400(GameValidator_1.gameIdParamSchema, req.params, res)))
            return;
        try {
            const { gameId } = req.params;
            const game = await this.gameService.getGame(gameId);
            if (!game)
                return res.status(404).send({ message: "Game not found" });
            res.send(filterGame(game));
        }
        catch (error) {
            handleError(res, error, "Error fetching game");
        }
    }
    // --- CREATION & MODIFICATION ---
    async createGame(req, res) {
        if (!(await validateOr400(GameValidator_1.createGameBodySchema, req.body, res)))
            return;
        try {
            const { name, description, price, download_link, showInStore, iconHash, splashHash, bannerHash, genre, release_date, developer, publisher, platforms, rating, website, trailer_link, multiplayer } = req.body;
            const gameId = (0, uuid_1.v4)();
            const ownerId = req.user.user_id;
            await this.gameService.createGame({
                gameId, name, description, price,
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
                multiplayer: multiplayer ?? false,
            });
            await this.gameService.addOwner(gameId, ownerId);
            res.status(201).send({ message: "Game created", game: await this.gameService.getGame(gameId) });
        }
        catch (error) {
            handleError(res, error, "Error creating game");
        }
    }
    async updateGame(req, res) {
        if (!(await validateOr400(GameValidator_1.gameIdParamSchema, req.params, res)))
            return;
        if (!(await validateOr400(GameValidator_1.updateGameBodySchema, req.body, res)))
            return;
        try {
            const game = await this.gameService.getGame(req.params.gameId);
            if (!game)
                return res.status(404).send({ message: "Game not found" });
            if (req.user.user_id !== game.owner_id)
                return res.status(403).send({ message: "You are not the owner of this game" });
            await this.gameService.updateGame(req.params.gameId, req.body);
            const updatedGame = await this.gameService.getGame(req.params.gameId);
            res.status(200).send(updatedGame ? filterGame(updatedGame, req.user.user_id) : null);
        }
        catch (error) {
            handleError(res, error, "Error updating game");
        }
    }
    // --- ACHAT ---
    async buyGame(req, res) {
        const { gameId } = req.params;
        const userId = req.user.user_id;
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game)
                return res.status(404).send({ message: "Game not found" });
            const userGames = await this.gameService.getUserGames(userId);
            if (userGames.some(g => g.gameId === gameId))
                return res.status(400).send({ message: "Game already owned" });
            if (game.owner_id === userId) {
                await this.gameService.addOwner(gameId, userId);
                return res.status(200).send({ message: "Game obtained" });
            }
            const user = await this.userService.getUser(userId);
            if (!user)
                return res.status(404).send({ message: "User not found" });
            if (user.balance < game.price)
                return res.status(400).send({ message: "Not enough balance" });
            await this.userService.updateUserBalance(userId, user.balance - game.price);
            const owner = await this.userService.getUser(game.owner_id);
            if (!owner)
                return res.status(404).send({ message: "Owner not found" });
            await this.userService.updateUserBalance(game.owner_id, owner.balance + game.price * 0.75);
            await this.gameService.addOwner(gameId, userId);
            res.status(200).send({ message: "Game purchased" });
        }
        catch (error) {
            handleError(res, error, "Error purchasing game");
        }
    }
};
__decorate([
    (0, describe_1.describe)({
        endpoint: "/games",
        method: "GET",
        description: "List all games visible in the store.",
        responseType: [gameResponseFields],
        example: "GET /api/games",
    }),
    (0, inversify_express_utils_1.httpGet)("/"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "listGames", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/games/search",
        method: "GET",
        description: "Search for games by name, genre, or description.",
        query: { q: "The search query" },
        responseType: [gameResponseFields],
        example: "GET /api/games/search?q=Minecraft",
    }),
    (0, inversify_express_utils_1.httpGet)("/search"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "searchGames", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/games/@mine",
        method: "GET",
        description: "Get all games created by the authenticated user.",
        responseType: [{ ...gameResponseFields, download_link: "string" }],
        example: "GET /api/games/@mine",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpGet)("/@mine", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "getMyCreatedGames", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/games/list/@me",
        method: "GET",
        description: 'Get all games owned by the authenticated user. Requires authentication via header "Authorization: Bearer <token>".',
        responseType: [{ ...gameResponseFields, download_link: "string" }],
        example: "GET /api/games/list/@me",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpGet)("/list/@me", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "getUserGames", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/games/:gameId",
        method: "GET",
        description: "Get a game by gameId.",
        params: { gameId: "The id of the game" },
        responseType: gameResponseFields,
        example: "GET /api/games/123",
    }),
    (0, inversify_express_utils_1.httpGet)(":gameId"),
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
    (0, inversify_express_utils_1.httpPut)(":gameId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Games.prototype, "updateGame", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)(":gameId/buy", LoggedCheck_1.LoggedCheck.middleware),
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
