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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Games = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const node_fetch_1 = __importDefault(require("node-fetch"));
const uuid_1 = require("uuid");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const GameValidator_1 = require("../validators/GameValidator");
const crypto_1 = __importDefault(require("crypto"));
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
        res.status(400).send({ message: 'Validation failed', errors: error.errors });
        return false;
    }
}
const createGameRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many game creations, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const updateGameRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many game updates, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const buyGameRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: 'Too many game purchases, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const transferOwnershipRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many ownership transfers, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const transferGameRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many game transfers, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
// Helper function to generate ETag
function generateETag(content) {
    return crypto_1.default.createHash('md5').update(content).digest('hex');
}
let Games = class Games {
    constructor(gameService, userService, logService, gameViewService) {
        this.gameService = gameService;
        this.userService = userService;
        this.logService = logService;
        this.gameViewService = gameViewService;
    }
    async createLog(req, action, tableName, statusCode, userId) {
        try {
            await this.logService.createLog({
                ip_address: req.headers['x-real-ip'] || req.socket.remoteAddress,
                table_name: tableName,
                controller: `GameController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: req.body,
                user_id: userId,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    logUnexpectedStatus(req, statusCode, message) {
        console.warn(`Unexpected status code ${statusCode} for request ${req.method} ${req.originalUrl}: ${message}`);
    }
    async listGames(req, res) {
        try {
            const games = await this.gameService.getStoreGames();
            const gameIds = games.map(game => game.gameId);
            const gamesWithBadgesAndViews = await this.gameService.getGamesWithBadgesAndViews(gameIds);
            await this.createLog(req, 'listGames', 'games', 200);
            res.send(gamesWithBadgesAndViews);
        }
        catch (error) {
            await this.createLog(req, 'listGames', 'games', 500);
            handleError(res, error, 'Error listing games');
        }
    }
    async searchGames(req, res) {
        const query = req.query.q?.trim();
        if (!query) {
            await this.createLog(req, 'searchGames', 'games', 400);
            return res.status(400).send({ message: 'Missing search query' });
        }
        try {
            const games = await this.gameService.searchGames(query);
            const gameIds = games.map(game => game.gameId);
            const gamesWithBadgesAndViews = await this.gameService.getGamesWithBadgesAndViews(gameIds);
            await this.createLog(req, 'searchGames', 'games', 200);
            res.send(gamesWithBadgesAndViews);
        }
        catch (error) {
            await this.createLog(req, 'searchGames', 'games', 500);
            handleError(res, error, 'Error searching games');
        }
    }
    async getMyCreatedGames(req, res) {
        try {
            const userId = req.user.user_id;
            const games = await this.gameService.getMyCreatedGames(userId);
            await this.createLog(req, 'getMyCreatedGames', 'games', 200, userId);
            res.send(games);
        }
        catch (error) {
            await this.createLog(req, 'getMyCreatedGames', 'games', 500, req.user?.user_id);
            handleError(res, error, 'Error fetching your created games');
        }
    }
    async getUserGames(req, res) {
        try {
            const games = await this.gameService.getUserOwnedGames(req.user.user_id);
            await this.createLog(req, 'getUserGames', 'games', 200, req.user.user_id);
            res.send(games);
        }
        catch (error) {
            await this.createLog(req, 'getUserGames', 'games', 500, req.user?.user_id);
            handleError(res, error, 'Error fetching user games');
        }
    }
    async getGame(req, res) {
        if (!(await validateOr400(GameValidator_1.gameIdParamSchema, req.params, res))) {
            await this.createLog(req, 'getGame', 'games', 400);
            return;
        }
        try {
            const { gameId } = req.params;
            const game = await this.gameService.getGameWithBadgesAndViews(gameId);
            if (!game) {
                await this.createLog(req, 'getGame', 'games', 404);
                return res.status(404).send({ message: 'Game not found' });
            }
            await this.createLog(req, 'getGame', 'games', 200);
            res.send(game);
        }
        catch (error) {
            await this.createLog(req, 'getGame', 'games', 500);
            handleError(res, error, 'Error fetching game');
        }
    }
    async getGameDetails(req, res) {
        if (!(await validateOr400(GameValidator_1.gameIdParamSchema, req.params, res))) {
            await this.createLog(req, 'getGameDetails', 'games', 400, req.user?.user_id);
            return;
        }
        try {
            const { gameId } = req.params;
            const userId = req.user.user_id;
            const game = await this.gameService.getGameForOwner(gameId, userId);
            if (!game) {
                await this.createLog(req, 'getGameDetails', 'games', 404, userId);
                return res.status(404).send({ message: 'Game not found' });
            }
            await this.createLog(req, 'getGameDetails', 'games', 200, userId);
            res.send(game);
        }
        catch (error) {
            await this.createLog(req, 'getGameDetails', 'games', 500, req.user?.user_id);
            handleError(res, error, 'Error fetching game details');
        }
    }
    async createGame(req, res) {
        if (!(await validateOr400(GameValidator_1.createGameBodySchema, req.body, res))) {
            await this.createLog(req, 'createGame', 'games', 400, req.user?.user_id);
            return;
        }
        try {
            const ownerId = req.user.user_id;
            const gameId = (0, uuid_1.v4)();
            await this.gameService.createGame({ ...req.body, gameId, owner_id: ownerId });
            await this.gameService.addOwner(gameId, ownerId);
            await this.createLog(req, 'createGame', 'games', 201, ownerId);
            res.status(201).send({ message: 'Game created', game: await this.gameService.getGame(gameId) });
        }
        catch (error) {
            await this.createLog(req, 'createGame', 'games', 500, req.user?.user_id);
            handleError(res, error, 'Error creating game');
        }
    }
    async updateGame(req, res) {
        if (!(await validateOr400(GameValidator_1.gameIdParamSchema, req.params, res))) {
            await this.createLog(req, 'updateGame', 'games', 400, req.user?.user_id);
            return;
        }
        if (!(await validateOr400(GameValidator_1.updateGameBodySchema, req.body, res))) {
            await this.createLog(req, 'updateGame', 'games', 400, req.user?.user_id);
            return;
        }
        try {
            const game = await this.gameService.getGame(req.params.gameId);
            if (!game) {
                await this.createLog(req, 'updateGame', 'games', 404, req.user?.user_id);
                return res.status(404).send({ message: 'Game not found' });
            }
            if (req.user.user_id !== game.owner_id) {
                await this.createLog(req, 'updateGame', 'games', 403, req.user?.user_id);
                return res.status(403).send({ message: 'You are not the owner of this game' });
            }
            await this.gameService.updateGame(req.params.gameId, req.body);
            const updatedGame = await this.gameService.getGame(req.params.gameId);
            await this.createLog(req, 'updateGame', 'games', 200, req.user.user_id);
            res.status(200).send(updatedGame);
        }
        catch (error) {
            await this.createLog(req, 'updateGame', 'games', 500, req.user?.user_id);
            handleError(res, error, 'Error updating game');
        }
    }
    async buyGame(req, res) {
        const { gameId } = req.params;
        const userId = req.user.user_id;
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                await this.createLog(req, 'buyGame', 'games', 404, userId);
                return res.status(404).send({ message: 'Game not found' });
            }
            const userGames = await this.gameService.getUserGames(userId);
            if (userGames.some(g => g.gameId === gameId)) {
                await this.createLog(req, 'buyGame', 'games', 400, userId);
                return res.status(400).send({ message: 'Game already owned' });
            }
            if (game.owner_id === userId) {
                await this.gameService.addOwner(gameId, userId);
                await this.createLog(req, 'buyGame', 'games', 200, userId);
                return res.status(200).send({ message: 'Game obtained' });
            }
            const user = await this.userService.getUser(userId);
            if (!user) {
                await this.createLog(req, 'buyGame', 'games', 404, userId);
                return res.status(404).send({ message: 'User not found' });
            }
            if (user.balance < game.price) {
                await this.createLog(req, 'buyGame', 'games', 400, userId);
                return res.status(400).send({ message: 'Not enough balance' });
            }
            await this.userService.updateUserBalance(userId, user.balance - game.price);
            const owner = await this.userService.getUser(game.owner_id);
            if (!owner) {
                await this.createLog(req, 'buyGame', 'games', 404, userId);
                return res.status(404).send({ message: 'Owner not found' });
            }
            await this.userService.updateUserBalance(game.owner_id, owner.balance + game.price * 0.75);
            await this.gameService.addOwner(gameId, userId);
            await this.createLog(req, 'buyGame', 'games', 200, userId);
            res.status(200).send({ message: 'Game purchased' });
        }
        catch (error) {
            await this.createLog(req, 'buyGame', 'games', 500, userId);
            handleError(res, error, 'Error purchasing game');
        }
    }
    async transferOwnership(req, res) {
        const { gameId } = req.params;
        const { newOwnerId } = req.body;
        const userId = req.user.user_id;
        if (!gameId || !newOwnerId) {
            await this.createLog(req, 'transferOwnership', 'games', 400, userId);
            return res.status(400).send({ message: 'Invalid input' });
        }
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                await this.createLog(req, 'transferOwnership', 'games', 404, userId);
                return res.status(404).send({ message: 'Game not found' });
            }
            if (game.owner_id !== userId) {
                await this.createLog(req, 'transferOwnership', 'games', 403, userId);
                return res.status(403).send({ message: 'You are not the owner of this game' });
            }
            const newOwner = await this.userService.getUser(newOwnerId);
            if (!newOwner) {
                await this.createLog(req, 'transferOwnership', 'games', 404, userId);
                return res.status(404).send({ message: 'New owner not found' });
            }
            await this.gameService.transferOwnership(gameId, newOwnerId);
            const updatedGame = await this.gameService.getGame(gameId);
            await this.createLog(req, 'transferOwnership', 'games', 200, userId);
            res.status(200).send({ message: 'Ownership transferred', game: updatedGame });
        }
        catch (error) {
            await this.createLog(req, 'transferOwnership', 'games', 500, userId);
            handleError(res, error, 'Error transferring ownership');
        }
    }
    async transferGame(req, res) {
        if (!(await validateOr400(GameValidator_1.gameIdParamSchema, req.params, res))) {
            await this.createLog(req, 'transferGame', 'games', 400, req.user?.user_id);
            return;
        }
        const { gameId } = req.params;
        const { targetUserId } = req.body;
        const fromUserId = req.user.user_id;
        if (!targetUserId || fromUserId === targetUserId) {
            await this.createLog(req, 'transferGame', 'games', 400, fromUserId);
            return res.status(400).send({ message: 'Invalid target user' });
        }
        try {
            const targetUser = await this.userService.getUser(targetUserId);
            if (!targetUser) {
                await this.createLog(req, 'transferGame', 'games', 404, fromUserId);
                return res.status(404).send({ message: 'Target user not found' });
            }
            const canTransfer = await this.gameService.canTransferGame(gameId, fromUserId, targetUserId);
            if (!canTransfer.canTransfer) {
                await this.createLog(req, 'transferGame', 'games', 400, fromUserId);
                return res.status(400).send({ message: canTransfer.reason });
            }
            await this.gameService.transferGameCopy(gameId, fromUserId, targetUserId);
            await this.createLog(req, 'transferGame', 'games', 200, fromUserId);
            res.status(200).send({ message: `Game successfully transferred to ${targetUser.username}` });
        }
        catch (error) {
            await this.createLog(req, 'transferGame', 'games', 500, fromUserId);
            handleError(res, error, 'Error transferring game');
        }
    }
    async canTransferGame(req, res) {
        if (!(await validateOr400(GameValidator_1.gameIdParamSchema, req.params, res))) {
            await this.createLog(req, 'canTransferGame', 'games', 400, req.user?.user_id);
            return;
        }
        const { gameId } = req.params;
        const { targetUserId } = req.query;
        const fromUserId = req.user.user_id;
        if (!targetUserId) {
            await this.createLog(req, 'canTransferGame', 'games', 400, fromUserId);
            return res.status(400).send({ message: 'Target user ID is required' });
        }
        try {
            const result = await this.gameService.canTransferGame(gameId, fromUserId, targetUserId);
            await this.createLog(req, 'canTransferGame', 'games', 200, fromUserId);
            res.send(result);
        }
        catch (error) {
            await this.createLog(req, 'canTransferGame', 'games', 500, fromUserId);
            handleError(res, error, 'Error checking transfer eligibility');
        }
    }
    async downloadGame(req, res) {
        const { gameId } = req.params;
        const userId = req.user.user_id;
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                return res.status(404).send({ message: 'Game not found' });
            }
            const owns = (await this.gameService.userOwnsGame(gameId, userId)) || game.owner_id === userId;
            if (!owns) {
                return res.status(403).send({ message: 'Access denied' });
            }
            const link = game.download_link;
            if (!link) {
                return res.status(404).send({ message: 'Download link not available' });
            }
            const headers = {};
            if (req.headers.range) {
                headers.Range = req.headers.range;
            }
            const fileRes = await (0, node_fetch_1.default)(link, { headers });
            if (!fileRes.ok) {
                return res.status(fileRes.status).send({ message: 'Error fetching file' });
            }
            res.setHeader('Content-Disposition', `attachment; filename="${game.name}.zip"`);
            res.setHeader('Content-Type', fileRes.headers.get('content-type') || 'application/octet-stream');
            const contentLength = fileRes.headers.get('content-length');
            if (contentLength !== null) {
                res.setHeader('Content-Length', contentLength);
            }
            const acceptRanges = fileRes.headers.get('accept-ranges');
            if (acceptRanges !== null) {
                res.setHeader('Accept-Ranges', acceptRanges);
            }
            const contentRange = fileRes.headers.get('content-range');
            if (contentRange !== null) {
                res.setHeader('Content-Range', contentRange);
            }
            res.status(fileRes.status);
            if (fileRes.body) {
                fileRes.body.pipe(res);
            }
            else {
                res.end();
            }
        }
        catch (error) {
            handleError(res, error, 'Error downloading game');
        }
    }
    async headDownloadGame(req, res) {
        const { gameId } = req.params;
        const userId = req.user.user_id;
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                return res.status(404).send({ message: 'Game not found' });
            }
            const owns = (await this.gameService.userOwnsGame(gameId, userId)) || game.owner_id === userId;
            if (!owns) {
                return res.status(403).send({ message: 'Access denied' });
            }
            const link = game.download_link;
            if (!link) {
                return res.status(404).send({ message: 'Download link not available' });
            }
            const headers = {};
            if (req.headers.range) {
                headers.Range = req.headers.range;
            }
            const fileRes = await (0, node_fetch_1.default)(link, { method: 'HEAD', headers });
            if (!fileRes.ok) {
                return res.status(fileRes.status).send({ message: 'Error fetching file headers' });
            }
            res.setHeader('Content-Disposition', `attachment; filename="${game.name}.zip"`);
            res.setHeader('Content-Type', fileRes.headers.get('content-type') || 'application/octet-stream');
            const contentLength = fileRes.headers.get('content-length');
            if (contentLength !== null) {
                res.setHeader('Content-Length', contentLength);
            }
            const acceptRanges = fileRes.headers.get('accept-ranges');
            if (acceptRanges !== null) {
                res.setHeader('Accept-Ranges', acceptRanges);
            }
            const contentRange = fileRes.headers.get('content-range');
            if (contentRange !== null) {
                res.setHeader('Content-Range', contentRange);
            }
            res.status(fileRes.status).end();
        }
        catch (error) {
            handleError(res, error, 'Error fetching file headers');
        }
    }
};
exports.Games = Games;
__decorate([
    (0, inversify_express_utils_1.httpGet)('/')
], Games.prototype, "listGames", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)('/search')
], Games.prototype, "searchGames", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)('/@mine', LoggedCheck_1.LoggedCheck.middleware)
], Games.prototype, "getMyCreatedGames", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)('/list/@me', LoggedCheck_1.LoggedCheck.middleware)
], Games.prototype, "getUserGames", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)(':gameId')
], Games.prototype, "getGame", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)(':gameId/details', LoggedCheck_1.LoggedCheck.middleware)
], Games.prototype, "getGameDetails", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)('/', LoggedCheck_1.LoggedCheck.middleware, createGameRateLimit)
], Games.prototype, "createGame", null);
__decorate([
    (0, inversify_express_utils_1.httpPut)(':gameId', LoggedCheck_1.LoggedCheck.middleware, updateGameRateLimit)
], Games.prototype, "updateGame", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)(':gameId/buy', LoggedCheck_1.LoggedCheck.middleware, buyGameRateLimit)
], Games.prototype, "buyGame", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)('/transfer-ownership/:gameId', LoggedCheck_1.LoggedCheck.middleware, transferOwnershipRateLimit)
], Games.prototype, "transferOwnership", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)(':gameId/transfer', LoggedCheck_1.LoggedCheck.middleware, transferGameRateLimit)
], Games.prototype, "transferGame", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)(':gameId/can-transfer', LoggedCheck_1.LoggedCheck.middleware)
], Games.prototype, "canTransferGame", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)('/:gameId/download', LoggedCheck_1.LoggedCheck.middleware)
], Games.prototype, "downloadGame", null);
__decorate([
    (0, inversify_express_utils_1.httpHead)('/:gameId/download', LoggedCheck_1.LoggedCheck.middleware)
], Games.prototype, "headDownloadGame", null);
exports.Games = Games = __decorate([
    (0, inversify_express_utils_1.controller)('/games'),
    __param(0, (0, inversify_1.inject)('GameService')),
    __param(1, (0, inversify_1.inject)('UserService')),
    __param(2, (0, inversify_1.inject)('LogService')),
    __param(3, (0, inversify_1.inject)('GameViewService'))
], Games);
