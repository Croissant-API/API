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
import { controller, httpDelete, httpGet, httpPost } from '../hono-inversify';
import { LoggedCheck } from '../middlewares/LoggedCheck';
let GameGifts = class GameGifts {
    constructor(giftService, gameService, userService, logService) {
        this.giftService = giftService;
        this.gameService = gameService;
        this.userService = userService;
        this.logService = logService;
    }
    async createLog(c, action, tableName, statusCode, userId, metadata) {
        try {
            const clientIP = c.req.header('cf-connecting-ip') ||
                c.req.header('x-forwarded-for') ||
                c.req.header('x-real-ip') ||
                'unknown';
            await this.logService.createLog({
                ip_address: clientIP,
                table_name: tableName,
                controller: `GameGiftController.${action}`,
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
    async handleGiftActions(c) {
        const action = c.req.param('action');
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const userId = user.user_id;
        const body = await c.req.json();
        try {
            switch (action) {
                case 'create': {
                    const { gameId, message } = body;
                    if (!gameId) {
                        await this.createLog(c, 'createGift', 'gifts', 400, userId);
                        return this.sendError(c, 400, 'Game ID is required');
                    }
                    const game = await this.gameService.getGame(gameId);
                    if (!game) {
                        await this.createLog(c, 'createGift', 'gifts', 404, userId);
                        return this.sendError(c, 404, 'Game not found');
                    }
                    const userObj = await this.userService.getUser(userId);
                    if (!userObj) {
                        await this.createLog(c, 'createGift', 'gifts', 404, userId);
                        return this.sendError(c, 404, 'User not found');
                    }
                    if (userObj.balance < game.price) {
                        await this.createLog(c, 'createGift', 'gifts', 400, userId);
                        return this.sendError(c, 400, `Insufficient balance. Required: ${game.price}, Available: ${userObj.balance}`);
                    }
                    if (userId !== game.owner_id) {
                        await this.userService.updateUserBalance(userId, userObj.balance - game.price);
                        const owner = await this.userService.getUser(game.owner_id);
                        if (owner) {
                            await this.userService.updateUserBalance(owner.user_id, owner.balance + game.price * 0.75);
                        }
                    }
                    const gift = await this.giftService.createGift(gameId, userId, message);
                    await this.createLog(c, 'createGift', 'gifts', 201, userId, { giftId: gift.id });
                    return c.json({
                        message: 'Gift created successfully',
                        gift: {
                            id: gift.id,
                            gameId: gift.gameId,
                            giftCode: gift.giftCode,
                            createdAt: gift.createdAt,
                            message: gift.message,
                        },
                    }, 201);
                }
                case 'claim': {
                    const { giftCode } = body;
                    if (!giftCode) {
                        await this.createLog(c, 'claimGift', 'gifts', 400, userId);
                        return this.sendError(c, 400, 'Gift code is required');
                    }
                    const gift = await this.giftService.getGift(giftCode);
                    if (!gift) {
                        await this.createLog(c, 'claimGift', 'gifts', 404, userId);
                        return this.sendError(c, 404, 'Invalid gift code');
                    }
                    const userOwnsGame = await this.gameService.userOwnsGame(gift.gameId, userId);
                    if (userOwnsGame) {
                        await this.createLog(c, 'claimGift', 'gifts', 400, userId);
                        return this.sendError(c, 400, 'You already own this game');
                    }
                    const claimedGift = await this.giftService.claimGift(giftCode, userId);
                    await this.gameService.addOwner(gift.gameId, userId);
                    await this.createLog(c, 'claimGift', 'gifts', 200, userId, { giftCode });
                    return c.json({
                        message: 'Gift claimed successfully',
                        gift: claimedGift,
                    });
                }
                default:
                    return this.sendError(c, 404, 'Unknown action');
            }
        }
        catch (error) {
            await this.createLog(c, action, 'gifts', 500, userId);
            return this.sendError(c, 500, `Error in ${action}`, error);
        }
    }
    async getSentGifts(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        try {
            const gifts = await this.giftService.getUserSentGifts(user.user_id);
            const enrichedGifts = await Promise.all(gifts.map(async (gift) => {
                const game = await this.gameService.getGameForPublic(gift.gameId);
                return {
                    ...gift,
                    game,
                };
            }));
            await this.createLog(c, 'getSentGifts', 'gifts', 200, user.user_id);
            return c.json(enrichedGifts);
        }
        catch (error) {
            await this.createLog(c, 'getSentGifts', 'gifts', 500, user.user_id);
            return this.sendError(c, 500, 'Error fetching sent gifts', error);
        }
    }
    async getReceivedGifts(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        try {
            const gifts = await this.giftService.getUserReceivedGifts(user.user_id);
            const enrichedGifts = await Promise.all(gifts.map(async (gift) => {
                const game = await this.gameService.getGameForPublic(gift.gameId);
                const fromUser = await this.userService.getUser(gift.fromUserId);
                return {
                    ...gift,
                    game,
                    fromUser: fromUser ? { id: fromUser.user_id, username: fromUser.username } : null,
                };
            }));
            await this.createLog(c, 'getReceivedGifts', 'gifts', 200, user.user_id);
            return c.json(enrichedGifts);
        }
        catch (error) {
            await this.createLog(c, 'getReceivedGifts', 'gifts', 500, user.user_id);
            return this.sendError(c, 500, 'Error fetching received gifts', error);
        }
    }
    async getGiftInfo(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const giftCode = c.req.param('giftCode');
        try {
            const gift = await this.giftService.getGift(giftCode);
            if (!gift) {
                await this.createLog(c, 'getGiftInfo', 'gifts', 404, user.user_id);
                return this.sendError(c, 404, 'Gift not found');
            }
            const game = await this.gameService.getGameForPublic(gift.gameId);
            const fromUser = await this.userService.getUser(gift.fromUserId);
            const userOwnsGame = await this.gameService.userOwnsGame(gift.gameId, user.user_id);
            await this.createLog(c, 'getGiftInfo', 'gifts', 200, user.user_id);
            return c.json({
                gift: {
                    gameId: gift.gameId,
                    giftCode: gift.giftCode,
                    createdAt: gift.createdAt,
                    claimedAt: gift.claimedAt,
                    isActive: gift.isActive,
                    message: gift.message,
                },
                game,
                fromUser: fromUser ? { id: fromUser.user_id, username: fromUser.username } : null,
                userOwnsGame,
            });
        }
        catch (error) {
            await this.createLog(c, 'getGiftInfo', 'gifts', 500, user.user_id);
            return this.sendError(c, 500, 'Error fetching gift info', error);
        }
    }
    async revokeGift(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const giftId = c.req.param('giftId');
        const userId = user.user_id;
        try {
            const gifts = await this.giftService.getUserSentGifts(userId);
            const gift = gifts.find(g => g.id === giftId);
            if (!gift) {
                await this.createLog(c, 'revokeGift', 'gifts', 404, userId);
                return this.sendError(c, 404, 'Gift not found');
            }
            if (!gift.isActive) {
                await this.createLog(c, 'revokeGift', 'gifts', 400, userId);
                return this.sendError(c, 400, 'Gift is no longer active');
            }
            await this.giftService.revokeGift(giftId, userId);
            const game = await this.gameService.getGame(gift.gameId);
            if (game) {
                const userObj = await this.userService.getUser(userId);
                if (userObj) {
                    await this.userService.updateUserBalance(userId, userObj.balance + game.price);
                }
                const owner = await this.userService.getUser(game.owner_id);
                if (owner) {
                    await this.userService.updateUserBalance(owner.user_id, owner.balance - game.price * 0.75);
                }
            }
            await this.createLog(c, 'revokeGift', 'gifts', 200, userId);
            return c.json({ message: 'Gift revoked successfully and refund processed' });
        }
        catch (error) {
            await this.createLog(c, 'revokeGift', 'gifts', 400, userId);
            return this.sendError(c, 400, 'Error revoking gift', error);
        }
    }
};
__decorate([
    httpPost('/:action', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], GameGifts.prototype, "handleGiftActions", null);
__decorate([
    httpGet('/sent', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], GameGifts.prototype, "getSentGifts", null);
__decorate([
    httpGet('/received', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], GameGifts.prototype, "getReceivedGifts", null);
__decorate([
    httpGet('/:giftCode', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], GameGifts.prototype, "getGiftInfo", null);
__decorate([
    httpDelete('/:giftId', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], GameGifts.prototype, "revokeGift", null);
GameGifts = __decorate([
    injectable(),
    controller('/gifts'),
    __param(0, inject('GameGiftService')),
    __param(1, inject('GameService')),
    __param(2, inject('UserService')),
    __param(3, inject('LogService')),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], GameGifts);
export { GameGifts };
