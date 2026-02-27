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
import { LoggedCheck } from 'middlewares/LoggedCheck';
import { describe } from '../decorators/describe';
import { controller, httpGet, httpPost, httpPut } from '../hono-inversify';
let Trades = class Trades {
    constructor(tradeService, logService) {
        this.tradeService = tradeService;
        this.logService = logService;
    }
    sendError(c, status, message, error) {
        const response = { message };
        if (error) {
            response.error = error;
        }
        return c.json(response, status);
    }
    async createLog(c, action, tableName, statusCode, userId, metadata, body) {
        try {
            let requestBody = body || { note: 'Body not provided for logging' };
            if (metadata) {
                requestBody = { ...requestBody, metadata };
            }
            const clientIP = c.req.header('cf-connecting-ip') ||
                c.req.header('x-forwarded-for') ||
                c.req.header('x-real-ip') ||
                'unknown';
            await this.logService.createLog({
                ip_address: clientIP,
                table_name: tableName,
                controller: `TradeController.${action}`,
                original_path: c.req.path,
                http_method: c.req.method,
                request_body: JSON.stringify(requestBody),
                user_id: userId,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    // Helper pour récupérer l'utilisateur authentifié depuis le context
    getUserFromContext(c) {
        return c.get('user');
    }
    async startOrGetPendingTrade(c) {
        try {
            const user = this.getUserFromContext(c);
            if (!user) {
                await this.createLog(c, 'startOrGetPendingTrade', 'trades', 401);
                return this.sendError(c, 401, 'Unauthorized');
            }
            const { userId } = c.req.param();
            const fromUserId = user.user_id;
            const toUserId = userId;
            if (fromUserId === toUserId) {
                await this.createLog(c, 'startOrGetPendingTrade', 'trades', 400, fromUserId, {
                    reason: 'self_trade_attempt',
                    target_user_id: toUserId,
                });
                return this.sendError(c, 400, 'Cannot trade with yourself');
            }
            const trade = await this.tradeService.startOrGetPendingTrade(fromUserId, toUserId);
            await this.createLog(c, 'startOrGetPendingTrade', 'trades', 200, fromUserId, {
                trade_id: trade.id,
                target_user_id: toUserId,
                trade_status: trade.status,
                is_new_trade: trade.createdAt === trade.updatedAt,
            });
            return c.json(trade, 200);
        }
        catch (error) {
            console.error('Error starting or getting trade:', error);
            const user = this.getUserFromContext(c);
            const { userId } = c.req.param();
            await this.createLog(c, 'startOrGetPendingTrade', 'trades', 500, user?.user_id, {
                target_user_id: userId,
                error: error instanceof Error ? error.message : String(error),
            });
            return this.sendError(c, 500, 'Error starting or getting trade', error instanceof Error ? error.message : String(error));
        }
    }
    async getTradeById(c) {
        try {
            const user = this.getUserFromContext(c);
            if (!user) {
                await this.createLog(c, 'getTradeById', 'trades', 401);
                return this.sendError(c, 401, 'Unauthorized');
            }
            const { id } = c.req.param();
            const trade = await this.tradeService.getFormattedTradeById(id);
            if (!trade) {
                await this.createLog(c, 'getTradeById', 'trades', 404, user.user_id, { trade_id: id });
                return this.sendError(c, 404, 'Trade not found');
            }
            if (trade.fromUserId !== user.user_id && trade.toUserId !== user.user_id) {
                await this.createLog(c, 'getTradeById', 'trades', 403, user.user_id, {
                    trade_id: id,
                    reason: 'not_participant',
                    from_user_id: trade.fromUserId,
                    to_user_id: trade.toUserId,
                });
                return this.sendError(c, 403, 'Forbidden');
            }
            await this.createLog(c, 'getTradeById', 'trades', 200, user.user_id, {
                trade_id: id,
                trade_status: trade.status,
                from_user_id: trade.fromUserId,
                to_user_id: trade.toUserId,
                items_count: {
                    from_user: trade.fromUserItems.length,
                    to_user: trade.toUserItems.length,
                },
            });
            return c.json(trade, 200);
        }
        catch (error) {
            console.error('Error fetching trade:', error);
            const user = this.getUserFromContext(c);
            const { id } = c.req.param();
            await this.createLog(c, 'getTradeById', 'trades', 500, user?.user_id, {
                trade_id: id,
                error: error instanceof Error ? error.message : String(error),
            });
            return this.sendError(c, 500, 'Error fetching trade', error instanceof Error ? error.message : String(error));
        }
    }
    async getTradesByUser(c) {
        try {
            const user = this.getUserFromContext(c);
            if (!user) {
                await this.createLog(c, 'getTradesByUser', 'trades', 401);
                return this.sendError(c, 401, 'Unauthorized');
            }
            const { userId } = c.req.param();
            if (userId !== user.user_id) {
                await this.createLog(c, 'getTradesByUser', 'trades', 403, user.user_id, {
                    reason: 'unauthorized_user_access',
                    requested_user_id: userId,
                });
                return this.sendError(c, 403, 'Forbidden');
            }
            const trades = await this.tradeService.getFormattedTradesByUser(userId);
            await this.createLog(c, 'getTradesByUser', 'trades', 200, user.user_id, {
                user_id: userId,
                trades_count: trades.length,
                trades_by_status: trades.reduce((acc, trade) => {
                    acc[trade.status] = (acc[trade.status] || 0) + 1;
                    return acc;
                }, {}),
            });
            return c.json(trades, 200);
        }
        catch (error) {
            console.error('Error fetching trades:', error);
            const user = this.getUserFromContext(c);
            const { userId } = c.req.param();
            await this.createLog(c, 'getTradesByUser', 'trades', 500, user?.user_id, {
                user_id: userId,
                error: error instanceof Error ? error.message : String(error),
            });
            return this.sendError(c, 500, 'Error fetching trades', error instanceof Error ? error.message : String(error));
        }
    }
    async addItemToTrade(c) {
        try {
            const user = this.getUserFromContext(c);
            if (!user) {
                await this.createLog(c, 'addItemToTrade', 'trade_items', 401);
                return this.sendError(c, 401, 'Unauthorized');
            }
            const { id } = c.req.param();
            const tradeId = id;
            const body = await c.req.json();
            const { tradeItem } = body;
            if (!tradeItem.itemId || !tradeItem.amount || tradeItem.amount <= 0) {
                await this.createLog(c, 'addItemToTrade', 'trade_items', 400, user.user_id, {
                    trade_id: tradeId,
                    action: 'add_item',
                    reason: 'invalid_trade_item_format',
                    trade_item: tradeItem,
                }, body);
                return this.sendError(c, 400, 'Invalid tradeItem format');
            }
            await this.tradeService.addItemToTrade(tradeId, user.user_id, tradeItem);
            await this.createLog(c, 'addItemToTrade', 'trade_items', 200, user.user_id, {
                trade_id: tradeId,
                action: 'add_item',
                item_id: tradeItem.itemId,
                amount: tradeItem.amount,
                has_metadata: !!tradeItem.metadata,
                has_unique_id: !!tradeItem.metadata?._unique_id,
            }, body);
            return c.json({ message: 'Item added to trade' }, 200);
        }
        catch (error) {
            console.error('Error adding item to trade:', error);
            const user = this.getUserFromContext(c);
            const { id } = c.req.param();
            const body = await c.req.json().catch(() => ({}));
            const { tradeItem } = body;
            await this.createLog(c, 'addItemToTrade', 'trade_items', 500, user?.user_id, {
                trade_id: id,
                action: 'add_item',
                item_id: tradeItem?.itemId,
                amount: tradeItem?.amount,
                error: error instanceof Error ? error.message : String(error),
            }, body);
            return this.sendError(c, 500, 'Error adding item to trade', error instanceof Error ? error.message : String(error));
        }
    }
    async removeItemFromTrade(c) {
        try {
            const user = this.getUserFromContext(c);
            if (!user) {
                await this.createLog(c, 'removeItemFromTrade', 'trade_items', 401);
                return this.sendError(c, 401, 'Unauthorized');
            }
            const { id } = c.req.param();
            const tradeId = id;
            const body = await c.req.json();
            const { tradeItem } = body;
            if (!tradeItem.itemId) {
                await this.createLog(c, 'removeItemFromTrade', 'trade_items', 400, user.user_id, {
                    trade_id: tradeId,
                    action: 'remove_item',
                    reason: 'missing_item_id',
                }, body);
                return this.sendError(c, 400, 'Invalid tradeItem format');
            }
            if (!tradeItem.metadata?._unique_id && (!tradeItem.amount || tradeItem.amount <= 0)) {
                await this.createLog(c, 'removeItemFromTrade', 'trade_items', 400, user.user_id, {
                    trade_id: tradeId,
                    action: 'remove_item',
                    reason: 'amount_required_for_non_unique_items',
                    item_id: tradeItem.itemId,
                }, body);
                return this.sendError(c, 400, 'Amount is required for items without _unique_id');
            }
            await this.tradeService.removeItemFromTrade(tradeId, user.user_id, tradeItem);
            await this.createLog(c, 'removeItemFromTrade', 'trade_items', 200, user.user_id, {
                trade_id: tradeId,
                action: 'remove_item',
                item_id: tradeItem.itemId,
                amount: tradeItem.amount,
                has_metadata: !!tradeItem.metadata,
                has_unique_id: !!tradeItem.metadata?._unique_id,
            }, body);
            return c.json({ message: 'Item removed from trade' }, 200);
        }
        catch (error) {
            console.error('Error removing item from trade:', error);
            const user = this.getUserFromContext(c);
            const { id } = c.req.param();
            const body = await c.req.json().catch(() => ({}));
            const { tradeItem } = body;
            await this.createLog(c, 'removeItemFromTrade', 'trade_items', 500, user?.user_id, {
                trade_id: id,
                action: 'remove_item',
                item_id: tradeItem?.itemId,
                amount: tradeItem?.amount,
                error: error instanceof Error ? error.message : String(error),
            }, body);
            return this.sendError(c, 500, 'Error removing item from trade', error instanceof Error ? error.message : String(error));
        }
    }
    async approveTrade(c) {
        try {
            const user = this.getUserFromContext(c);
            if (!user) {
                await this.createLog(c, 'approveTrade', 'trades', 401);
                return this.sendError(c, 401, 'Unauthorized');
            }
            const { id } = c.req.param();
            const tradeId = id;
            await this.tradeService.approveTrade(tradeId, user.user_id);
            await this.createLog(c, 'approveTrade', 'trades', 200, user.user_id, {
                trade_id: tradeId,
                action: 'approve',
            });
            return c.json({ message: 'Trade approved' }, 200);
        }
        catch (error) {
            console.error('Error approving trade:', error);
            const user = this.getUserFromContext(c);
            const { id } = c.req.param();
            await this.createLog(c, 'approveTrade', 'trades', 500, user?.user_id, {
                trade_id: id,
                action: 'approve',
                error: error instanceof Error ? error.message : String(error),
            });
            return this.sendError(c, 500, 'Error approving trade', error instanceof Error ? error.message : String(error));
        }
    }
    async cancelTrade(c) {
        try {
            const user = this.getUserFromContext(c);
            if (!user) {
                await this.createLog(c, 'cancelTrade', 'trades', 401);
                return this.sendError(c, 401, 'Unauthorized');
            }
            const { id } = c.req.param();
            const tradeId = id;
            await this.tradeService.cancelTrade(tradeId, user.user_id);
            await this.createLog(c, 'cancelTrade', 'trades', 200, user.user_id, {
                trade_id: tradeId,
                action: 'cancel',
            });
            return c.json({ message: 'Trade canceled' }, 200);
        }
        catch (error) {
            console.error('Error canceling trade:', error);
            const user = this.getUserFromContext(c);
            const { id } = c.req.param();
            await this.createLog(c, 'cancelTrade', 'trades', 500, user?.user_id, {
                trade_id: id,
                action: 'cancel',
                error: error instanceof Error ? error.message : String(error),
            });
            return this.sendError(c, 500, 'Error canceling trade', error instanceof Error ? error.message : String(error));
        }
    }
};
__decorate([
    describe({
        endpoint: '/trades/start-or-latest/:userId',
        method: 'POST',
        description: 'Start a new trade or get the latest pending trade with a user',
        params: { userId: 'The ID of the user to trade with' },
        responseType: {
            id: 'string',
            fromUserId: 'string',
            toUserId: 'string',
            fromUserItems: ['object'],
            toUserItems: ['object'],
            approvedFromUser: 'boolean',
            approvedToUser: 'boolean',
            status: 'string',
            createdAt: 'string',
            updatedAt: 'string',
        },
        example: 'POST /api/trades/start-or-latest/user123',
        requiresAuth: true,
    }),
    httpPost('/start-or-latest/:userId', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "startOrGetPendingTrade", null);
__decorate([
    describe({
        endpoint: '/trades/:id',
        method: 'GET',
        description: 'Get a trade by ID with enriched item information',
        params: { id: 'The ID of the trade' },
        responseType: {
            id: 'string',
            fromUserId: 'string',
            toUserId: 'string',
            fromUserItems: [
                {
                    itemId: 'string',
                    name: 'string',
                    description: 'string',
                    iconHash: 'string',
                    amount: 'number',
                },
            ],
            toUserItems: [
                {
                    itemId: 'string',
                    name: 'string',
                    description: 'string',
                    iconHash: 'string',
                    amount: 'number',
                },
            ],
            approvedFromUser: 'boolean',
            approvedToUser: 'boolean',
            status: 'string',
            createdAt: 'string',
            updatedAt: 'string',
        },
        example: 'GET /api/trades/trade123',
        requiresAuth: true,
    }),
    httpGet('/:id', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "getTradeById", null);
__decorate([
    describe({
        endpoint: '/trades/user/:userId',
        method: 'GET',
        description: 'Get all trades for a user with enriched item information',
        params: { userId: 'The ID of the user' },
        responseType: [
            {
                id: 'string',
                fromUserId: 'string',
                toUserId: 'string',
                fromUserItems: [
                    {
                        itemId: 'string',
                        name: 'string',
                        description: 'string',
                        iconHash: 'string',
                        amount: 'number',
                    },
                ],
                toUserItems: [
                    {
                        itemId: 'string',
                        name: 'string',
                        description: 'string',
                        iconHash: 'string',
                        amount: 'number',
                    },
                ],
                approvedFromUser: 'boolean',
                approvedToUser: 'boolean',
                status: 'string',
                createdAt: 'string',
                updatedAt: 'string',
            },
        ],
        example: 'GET /api/trades/user/user123',
        requiresAuth: true,
    }),
    httpGet('/user/:userId', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "getTradesByUser", null);
__decorate([
    describe({
        endpoint: '/trades/:id/add-item',
        method: 'POST',
        description: 'Add an item to a trade',
        params: { id: 'The ID of the trade' },
        body: {
            tradeItem: {
                itemId: 'The ID of the item to add',
                amount: 'The amount of the item to add',
                metadata: 'Metadata object including _unique_id for unique items (optional)',
            },
        },
        responseType: { message: 'string' },
        example: 'POST /api/trades/trade123/add-item {"tradeItem": {"itemId": "item456", "amount": 5}} or {"tradeItem": {"itemId": "item456", "amount": 1, "metadata": {"level": 5, "_unique_id": "abc-123"}}}',
        requiresAuth: true,
    }),
    httpPost('/:id/add-item', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "addItemToTrade", null);
__decorate([
    describe({
        endpoint: '/trades/:id/remove-item',
        method: 'POST',
        description: 'Remove an item from a trade',
        params: { id: 'The ID of the trade' },
        body: {
            tradeItem: {
                itemId: 'The ID of the item to remove',
                amount: 'The amount of the item to remove',
                metadata: 'Metadata object including _unique_id for unique items (optional)',
            },
        },
        responseType: { message: 'string' },
        example: 'POST /api/trades/trade123/remove-item {"tradeItem": {"itemId": "item456", "amount": 2}} or {"tradeItem": {"itemId": "item456", "metadata": {"_unique_id": "abc-123"}}}',
        requiresAuth: true,
    }),
    httpPost('/:id/remove-item', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "removeItemFromTrade", null);
__decorate([
    describe({
        endpoint: '/trades/:id/approve',
        method: 'PUT',
        description: 'Approve a trade',
        params: { id: 'The ID of the trade' },
        responseType: { message: 'string' },
        example: 'PUT /api/trades/trade123/approve',
        requiresAuth: true,
    }),
    httpPut('/:id/approve', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "approveTrade", null);
__decorate([
    describe({
        endpoint: '/trades/:id/cancel',
        method: 'PUT',
        description: 'Cancel a trade',
        params: { id: 'The ID of the trade' },
        responseType: { message: 'string' },
        example: 'PUT /api/trades/trade123/cancel',
        requiresAuth: true,
    }),
    httpPut('/:id/cancel', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Trades.prototype, "cancelTrade", null);
Trades = __decorate([
    injectable(),
    controller('/trades'),
    __param(0, inject('TradeService')),
    __param(1, inject('LogService')),
    __metadata("design:paramtypes", [Object, Object])
], Trades);
export { Trades };
