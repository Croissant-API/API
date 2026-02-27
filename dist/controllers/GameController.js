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
import { inject, injectable } from 'inversify';
import { v4 } from 'uuid';
import { controller, httpGet, httpHead, httpPost, httpPut } from '../hono-inversify';
import { createRateLimit } from '../middlewares/hono/rateLimit';
import { LoggedCheck } from '../middlewares/LoggedCheck';
import { createGameBodySchema, gameIdParamSchema, updateGameBodySchema } from '../validators/GameValidator';
// Rate limits using the hono rate limit middleware
const createGameRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many game creations, please try again later.' });
const updateGameRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many game updates, please try again later.' });
const buyGameRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: 'Too many game purchases, please try again later.' });
const transferOwnershipRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many ownership transfers, please try again later.' });
const transferGameRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many game transfers, please try again later.' });
async function validateOr400(schema, data, c) {
    try {
        await schema.validate(data);
        return true;
    }
    catch (error) {
        await c.json({ message: 'Validation failed', errors: error.errors }, 400);
        return false;
    }
}
let Games = class Games {
    constructor(gameService, userService, logService, gameViewService) {
        this.gameService = gameService;
        this.userService = userService;
        this.logService = logService;
        this.gameViewService = gameViewService;
    }
    async createLog(c, action, tableName, statusCode, userId, metadata = {}) {
        try {
            const clientIP = c.req.header('cf-connecting-ip') ||
                c.req.header('x-forwarded-for') ||
                c.req.header('x-real-ip') ||
                'unknown';
            await this.logService.createLog({
                ip_address: clientIP,
                table_name: tableName,
                controller: `GameController.${action}`,
                original_path: c.req.path,
                http_method: c.req.method,
                request_body: JSON.stringify(metadata || {}),
                user_id: userId,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    sendError(c, status, message, error) {
        return c.json({ message, error: error ? (error instanceof Error ? error.message : String(error)) : undefined }, status);
    }
    getUserFromContext(c) {
        return c.get('user');
    }
    async listGames(c) {
        try {
            const games = await this.gameService.getStoreGames();
            const gameIds = games.map(game => game.gameId);
            const gamesWithBadgesAndViews = await this.gameService.getGamesWithBadgesAndViews(gameIds);
            await this.createLog(c, 'listGames', 'games', 200);
            return c.json(gamesWithBadgesAndViews);
        }
        catch (error) {
            await this.createLog(c, 'listGames', 'games', 500);
            return this.sendError(c, 500, 'Error listing games', error);
        }
    }
    async searchGames(c) {
        const query = c.req.query('q')?.trim();
        if (!query) {
            await this.createLog(c, 'searchGames', 'games', 400);
            return this.sendError(c, 400, 'Missing search query');
        }
        try {
            const games = await this.gameService.searchGames(query);
            const gameIds = games.map(game => game.gameId);
            const gamesWithBadgesAndViews = await this.gameService.getGamesWithBadgesAndViews(gameIds);
            await this.createLog(c, 'searchGames', 'games', 200);
            return c.json(gamesWithBadgesAndViews);
        }
        catch (error) {
            await this.createLog(c, 'searchGames', 'games', 500);
            return this.sendError(c, 500, 'Error searching games', error);
        }
    }
    async getMyCreatedGames(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        try {
            const games = await this.gameService.getMyCreatedGames(user.user_id);
            await this.createLog(c, 'getMyCreatedGames', 'games', 200, user.user_id);
            return c.json(games);
        }
        catch (error) {
            await this.createLog(c, 'getMyCreatedGames', 'games', 500, user.user_id);
            return this.sendError(c, 500, 'Error fetching your created games', error);
        }
    }
    async getUserGames(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        try {
            const games = await this.gameService.getUserOwnedGames(user.user_id);
            await this.createLog(c, 'getUserGames', 'games', 200, user.user_id);
            return c.json(games);
        }
        catch (error) {
            await this.createLog(c, 'getUserGames', 'games', 500, user.user_id);
            return this.sendError(c, 500, 'Error fetching user games', error);
        }
    }
    async getGame(c) {
        if (!(await validateOr400(gameIdParamSchema, { gameId: c.req.param('gameId') }, c))) {
            await this.createLog(c, 'getGame', 'games', 400);
            return;
        }
        try {
            const gameId = c.req.param('gameId');
            const game = await this.gameService.getGameWithBadgesAndViews(gameId);
            if (!game) {
                await this.createLog(c, 'getGame', 'games', 404);
                return this.sendError(c, 404, 'Game not found');
            }
            await this.createLog(c, 'getGame', 'games', 200);
            return c.json(game);
        }
        catch (error) {
            await this.createLog(c, 'getGame', 'games', 500);
            return this.sendError(c, 500, 'Error fetching game', error);
        }
    }
    async getGameDetails(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        if (!(await validateOr400(gameIdParamSchema, { gameId: c.req.param('gameId') }, c))) {
            await this.createLog(c, 'getGameDetails', 'games', 400, user.user_id);
            return;
        }
        try {
            const gameId = c.req.param('gameId');
            const game = await this.gameService.getGameForOwner(gameId, user.user_id);
            if (!game) {
                await this.createLog(c, 'getGameDetails', 'games', 404, user.user_id);
                return this.sendError(c, 404, 'Game not found');
            }
            await this.createLog(c, 'getGameDetails', 'games', 200, user.user_id);
            return c.json(game);
        }
        catch (error) {
            await this.createLog(c, 'getGameDetails', 'games', 500, user.user_id);
            return this.sendError(c, 500, 'Error fetching game details', error);
        }
    }
    async createGame(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const body = await c.req.json();
        if (!(await validateOr400(createGameBodySchema, body, c))) {
            await this.createLog(c, 'createGame', 'games', 400, user.user_id);
            return;
        }
        try {
            const ownerId = user.user_id;
            const gameId = v4();
            await this.gameService.createGame({ ...body, gameId, owner_id: ownerId });
            await this.gameService.addOwner(gameId, ownerId);
            await this.createLog(c, 'createGame', 'games', 201, ownerId);
            return c.json({ message: 'Game created', game: await this.gameService.getGame(gameId) }, 201);
        }
        catch (error) {
            await this.createLog(c, 'createGame', 'games', 500, user.user_id);
            return this.sendError(c, 500, 'Error creating game', error);
        }
    }
    async updateGame(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        if (!(await validateOr400(gameIdParamSchema, { gameId: c.req.param('gameId') }, c))) {
            await this.createLog(c, 'updateGame', 'games', 400, user.user_id);
            return;
        }
        const body = await c.req.json();
        if (!(await validateOr400(updateGameBodySchema, body, c))) {
            await this.createLog(c, 'updateGame', 'games', 400, user.user_id);
            return;
        }
        try {
            const game = await this.gameService.getGame(c.req.param('gameId'));
            if (!game) {
                await this.createLog(c, 'updateGame', 'games', 404, user.user_id);
                return this.sendError(c, 404, 'Game not found');
            }
            if (user.user_id !== game.owner_id) {
                await this.createLog(c, 'updateGame', 'games', 403, user.user_id);
                return this.sendError(c, 403, 'You are not the owner of this game');
            }
            await this.gameService.updateGame(c.req.param('gameId'), body);
            const updatedGame = await this.gameService.getGame(c.req.param('gameId'));
            await this.createLog(c, 'updateGame', 'games', 200, user.user_id);
            return c.json(updatedGame, 200);
        }
        catch (error) {
            await this.createLog(c, 'updateGame', 'games', 500, user.user_id);
            return this.sendError(c, 500, 'Error updating game', error);
        }
    }
    async buyGame(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const gameId = c.req.param('gameId');
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                await this.createLog(c, 'buyGame', 'games', 404, user.user_id);
                return this.sendError(c, 404, 'Game not found');
            }
            const userGames = await this.gameService.getUserGames(user.user_id);
            if (userGames.some(g => g.gameId === gameId)) {
                await this.createLog(c, 'buyGame', 'games', 400, user.user_id);
                return this.sendError(c, 400, 'Game already owned');
            }
            if (game.owner_id === user.user_id) {
                await this.gameService.addOwner(gameId, user.user_id);
                await this.createLog(c, 'buyGame', 'games', 200, user.user_id);
                return c.json({ message: 'Game obtained' }, 200);
            }
            const userObj = await this.userService.getUser(user.user_id);
            if (!userObj) {
                await this.createLog(c, 'buyGame', 'games', 404, user.user_id);
                return this.sendError(c, 404, 'User not found');
            }
            if (userObj.balance < game.price) {
                await this.createLog(c, 'buyGame', 'games', 400, user.user_id);
                return this.sendError(c, 400, 'Not enough balance');
            }
            await this.userService.updateUserBalance(user.user_id, userObj.balance - game.price);
            const owner = await this.userService.getUser(game.owner_id);
            if (!owner) {
                await this.createLog(c, 'buyGame', 'games', 404, user.user_id);
                return this.sendError(c, 404, 'Owner not found');
            }
            await this.userService.updateUserBalance(game.owner_id, owner.balance + game.price * 0.75);
            await this.gameService.addOwner(gameId, user.user_id);
            await this.createLog(c, 'buyGame', 'games', 200, user.user_id);
            return c.json({ message: 'Game purchased' }, 200);
        }
        catch (error) {
            await this.createLog(c, 'buyGame', 'games', 500, user.user_id);
            return this.sendError(c, 500, 'Error purchasing game', error);
        }
    }
    async transferOwnership(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const gameId = c.req.param('gameId');
        const { newOwnerId } = await c.req.json();
        if (!gameId || !newOwnerId) {
            await this.createLog(c, 'transferOwnership', 'games', 400, user.user_id);
            return this.sendError(c, 400, 'Invalid input');
        }
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                await this.createLog(c, 'transferOwnership', 'games', 404, user.user_id);
                return this.sendError(c, 404, 'Game not found');
            }
            if (game.owner_id !== user.user_id) {
                await this.createLog(c, 'transferOwnership', 'games', 403, user.user_id);
                return this.sendError(c, 403, 'You are not the owner of this game');
            }
            const newOwner = await this.userService.getUser(newOwnerId);
            if (!newOwner) {
                await this.createLog(c, 'transferOwnership', 'games', 404, user.user_id);
                return this.sendError(c, 404, 'New owner not found');
            }
            await this.gameService.transferOwnership(gameId, newOwnerId);
            const updatedGame = await this.gameService.getGame(gameId);
            await this.createLog(c, 'transferOwnership', 'games', 200, user.user_id);
            return c.json({ message: 'Ownership transferred', game: updatedGame }, 200);
        }
        catch (error) {
            await this.createLog(c, 'transferOwnership', 'games', 500, user.user_id);
            return this.sendError(c, 500, 'Error transferring ownership', error);
        }
    }
    async transferGame(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        if (!(await validateOr400(gameIdParamSchema, { gameId: c.req.param('gameId') }, c))) {
            await this.createLog(c, 'transferGame', 'games', 400, user.user_id);
            return;
        }
        const { targetUserId } = await c.req.json();
        const fromUserId = user.user_id;
        if (!targetUserId || fromUserId === targetUserId) {
            await this.createLog(c, 'transferGame', 'games', 400, fromUserId);
            return this.sendError(c, 400, 'Invalid target user');
        }
        try {
            const targetUser = await this.userService.getUser(targetUserId);
            if (!targetUser) {
                await this.createLog(c, 'transferGame', 'games', 404, fromUserId);
                return this.sendError(c, 404, 'Target user not found');
            }
            const canTransfer = await this.gameService.canTransferGame(c.req.param('gameId'), fromUserId, targetUserId);
            if (!canTransfer.canTransfer) {
                await this.createLog(c, 'transferGame', 'games', 400, fromUserId);
                return this.sendError(c, 400, canTransfer.reason || 'Cannot transfer game');
            }
            await this.gameService.transferGameCopy(c.req.param('gameId'), fromUserId, targetUserId);
            await this.createLog(c, 'transferGame', 'games', 200, fromUserId);
            return c.json({ message: `Game successfully transferred to ${targetUser.username}` }, 200);
        }
        catch (error) {
            await this.createLog(c, 'transferGame', 'games', 500, fromUserId);
            return this.sendError(c, 500, 'Error transferring game', error);
        }
    }
    async canTransferGame(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        if (!(await validateOr400(gameIdParamSchema, { gameId: c.req.param('gameId') }, c))) {
            await this.createLog(c, 'canTransferGame', 'games', 400, user.user_id);
            return;
        }
        const targetUserId = c.req.query('targetUserId');
        const fromUserId = user.user_id;
        if (!targetUserId) {
            await this.createLog(c, 'canTransferGame', 'games', 400, fromUserId);
            return this.sendError(c, 400, 'Target user ID is required');
        }
        try {
            const result = await this.gameService.canTransferGame(c.req.param('gameId'), fromUserId, targetUserId);
            await this.createLog(c, 'canTransferGame', 'games', 200, fromUserId);
            return c.json(result);
        }
        catch (error) {
            await this.createLog(c, 'canTransferGame', 'games', 500, fromUserId);
            return this.sendError(c, 500, 'Error checking transfer eligibility', error);
        }
    }
    // Download endpoints: implementation depends on your file serving strategy with Hono.
    // You may need to use c.res for streaming, or return a redirect to a signed URL.
    async downloadGame(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const gameId = c.req.param('gameId');
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game)
                return this.sendError(c, 404, 'Game not found');
            const owns = (await this.gameService.userOwnsGame(gameId, user.user_id)) || game.owner_id === user.user_id;
            if (!owns)
                return this.sendError(c, 403, 'Access denied');
            const link = game.download_link;
            if (!link)
                return this.sendError(c, 404, 'Download link not available');
            const headers = {};
            const range = c.req.header('range');
            if (range)
                headers['Range'] = range;
            const fileRes = await fetch(link, { headers });
            if (!fileRes.ok) {
                return this.sendError(c, fileRes.status, 'Error fetching file');
            }
            c.header('Content-Disposition', `attachment; filename="${game.name}.zip"`);
            c.header('Content-Type', fileRes.headers.get('content-type') || 'application/octet-stream');
            const contentLength = fileRes.headers.get('content-length');
            if (contentLength)
                c.header('Content-Length', contentLength);
            const acceptRanges = fileRes.headers.get('accept-ranges');
            if (acceptRanges)
                c.header('Accept-Ranges', acceptRanges);
            const contentRange = fileRes.headers.get('content-range');
            if (contentRange)
                c.header('Content-Range', contentRange);
            // Stream le body du fichier distant
            return new Response(fileRes.body, {
                status: fileRes.status,
                headers: c.res.headers,
            });
        }
        catch (error) {
            return this.sendError(c, 500, 'Error downloading game', error);
        }
    }
    async headDownloadGame(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const gameId = c.req.param('gameId');
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game)
                return this.sendError(c, 404, 'Game not found');
            const owns = (await this.gameService.userOwnsGame(gameId, user.user_id)) || game.owner_id === user.user_id;
            if (!owns)
                return this.sendError(c, 403, 'Access denied');
            const link = game.download_link;
            if (!link)
                return this.sendError(c, 404, 'Download link not available');
            const headers = {};
            const range = c.req.header('range');
            if (range)
                headers['Range'] = range;
            const fileRes = await fetch(link, { method: 'HEAD', headers });
            if (!fileRes.ok) {
                return this.sendError(c, fileRes.status, 'Error fetching file headers');
            }
            c.header('Content-Disposition', `attachment; filename="${game.name}.zip"`);
            c.header('Content-Type', fileRes.headers.get('content-type') || 'application/octet-stream');
            const contentLength = fileRes.headers.get('content-length');
            if (contentLength)
                c.header('Content-Length', contentLength);
            const acceptRanges = fileRes.headers.get('accept-ranges');
            if (acceptRanges)
                c.header('Accept-Ranges', acceptRanges);
            const contentRange = fileRes.headers.get('content-range');
            if (contentRange)
                c.header('Content-Range', contentRange);
            return c.body(null, fileRes.status);
        }
        catch (error) {
            return this.sendError(c, 500, 'Error fetching file headers', error);
        }
    }
};
__decorate([
    httpGet('/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "listGames", null);
__decorate([
    httpGet('/search'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "searchGames", null);
__decorate([
    httpGet('/@mine', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "getMyCreatedGames", null);
__decorate([
    httpGet('/list/@me', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "getUserGames", null);
__decorate([
    httpGet('/:gameId'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "getGame", null);
__decorate([
    httpGet('/:gameId/details', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "getGameDetails", null);
__decorate([
    httpPost('/', LoggedCheck, createGameRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "createGame", null);
__decorate([
    httpPut('/:gameId', LoggedCheck, updateGameRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "updateGame", null);
__decorate([
    httpPost('/:gameId/buy', LoggedCheck, buyGameRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "buyGame", null);
__decorate([
    httpPost('/transfer-ownership/:gameId', LoggedCheck, transferOwnershipRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "transferOwnership", null);
__decorate([
    httpPost('/:gameId/transfer', LoggedCheck, transferGameRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "transferGame", null);
__decorate([
    httpGet('/:gameId/can-transfer', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "canTransferGame", null);
__decorate([
    httpGet('/:gameId/download', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "downloadGame", null);
__decorate([
    httpHead('/:gameId/download', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Games.prototype, "headDownloadGame", null);
Games = __decorate([
    injectable(),
    controller('/games'),
    __param(0, inject('GameService')),
    __param(1, inject('UserService')),
    __param(2, inject('LogService')),
    __param(3, inject('GameViewService')),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], Games);
export { Games };
