/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono';
import { inject, injectable } from 'inversify';
import { v4 } from 'uuid';
import * as yup from 'yup';
import { controller, httpGet, httpHead, httpPost, httpPut } from '../hono-inversify';
import { createRateLimit } from '../middlewares/hono/rateLimit';
import { LoggedCheck } from '../middlewares/LoggedCheck';
import { IGameService } from '../services/GameService';
import { IGameViewService } from '../services/GameViewService';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
import { createGameBodySchema, gameIdParamSchema, updateGameBodySchema } from '../validators/GameValidator';

// Rate limits using the hono rate limit middleware
const createGameRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many game creations, please try again later.' });
const updateGameRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many game updates, please try again later.' });
const buyGameRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: 'Too many game purchases, please try again later.' });
const transferOwnershipRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many ownership transfers, please try again later.' });
const transferGameRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many game transfers, please try again later.' });


async function validateOr400(schema: yup.Schema<unknown>, data: unknown, c: Context) {
  try {
    await schema.validate(data);
    return true;
  } catch (error) {
    await c.json({ message: 'Validation failed', errors: (error as yup.ValidationError).errors }, 400);
    return false;
  }
}

@injectable()
@controller('/games')
export class Games {
  constructor(
    @inject('GameService') private gameService: IGameService,
    @inject('UserService') private userService: IUserService,
    @inject('LogService') private logService: ILogService,
    @inject('GameViewService') private gameViewService: IGameViewService
  ) {}

  private async createLog(c: Context, action: string, tableName?: string, statusCode?: number, userId?: string, metadata: any = {}) {
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
    } catch (error) {
      console.error('Error creating log:', error);
    }
  }

  private sendError(c: Context, status: number, message: string, error?: any) {
    return c.json({ message, error: error ? (error instanceof Error ? error.message : String(error)) : undefined }, status as any);
  }

  private getUserFromContext(c: Context) {
    return c.get('user');
  }

  @httpGet('/')
  public async listGames(c: Context) {
    try {
      const games = await this.gameService.getStoreGames();
      const gameIds = games.map(game => game.gameId);
      const gamesWithBadgesAndViews = await this.gameService.getGamesWithBadgesAndViews(gameIds);
      await this.createLog(c, 'listGames', 'games', 200);
      return c.json(gamesWithBadgesAndViews);
    } catch (error) {
      await this.createLog(c, 'listGames', 'games', 500);
      return this.sendError(c, 500, 'Error listing games', error);
    }
  }

  @httpGet('/search')
  public async searchGames(c: Context) {
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
    } catch (error) {
      await this.createLog(c, 'searchGames', 'games', 500);
      return this.sendError(c, 500, 'Error searching games', error);
    }
  }

  @httpGet('/@mine', LoggedCheck)
  public async getMyCreatedGames(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    try {
      const games = await this.gameService.getMyCreatedGames(user.user_id);
      await this.createLog(c, 'getMyCreatedGames', 'games', 200, user.user_id);
      return c.json(games);
    } catch (error) {
      await this.createLog(c, 'getMyCreatedGames', 'games', 500, user.user_id);
      return this.sendError(c, 500, 'Error fetching your created games', error);
    }
  }

  @httpGet('/list/@me', LoggedCheck)
  public async getUserGames(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    try {
      const games = await this.gameService.getUserOwnedGames(user.user_id);
      await this.createLog(c, 'getUserGames', 'games', 200, user.user_id);
      return c.json(games);
    } catch (error) {
      await this.createLog(c, 'getUserGames', 'games', 500, user.user_id);
      return this.sendError(c, 500, 'Error fetching user games', error);
    }
  }

  @httpGet('/:gameId')
  public async getGame(c: Context) {
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
    } catch (error) {
      await this.createLog(c, 'getGame', 'games', 500);
      return this.sendError(c, 500, 'Error fetching game', error);
    }
  }

  @httpGet('/:gameId/details', LoggedCheck)
  public async getGameDetails(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
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
    } catch (error) {
      await this.createLog(c, 'getGameDetails', 'games', 500, user.user_id);
      return this.sendError(c, 500, 'Error fetching game details', error);
    }
  }

  @httpPost('/', LoggedCheck, createGameRateLimit)
  public async createGame(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
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
    } catch (error) {
      await this.createLog(c, 'createGame', 'games', 500, user.user_id);
      return this.sendError(c, 500, 'Error creating game', error);
    }
  }

  @httpPut('/:gameId', LoggedCheck, updateGameRateLimit)
  public async updateGame(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
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
    } catch (error) {
      await this.createLog(c, 'updateGame', 'games', 500, user.user_id);
      return this.sendError(c, 500, 'Error updating game', error);
    }
  }

  @httpPost('/:gameId/buy', LoggedCheck, buyGameRateLimit)
  public async buyGame(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
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
    } catch (error) {
      await this.createLog(c, 'buyGame', 'games', 500, user.user_id);
      return this.sendError(c, 500, 'Error purchasing game', error);
    }
  }

  @httpPost('/transfer-ownership/:gameId', LoggedCheck, transferOwnershipRateLimit)
  public async transferOwnership(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
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
    } catch (error) {
      await this.createLog(c, 'transferOwnership', 'games', 500, user.user_id);
      return this.sendError(c, 500, 'Error transferring ownership', error);
    }
  }

  @httpPost('/:gameId/transfer', LoggedCheck, transferGameRateLimit)
  public async transferGame(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
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
    } catch (error) {
      await this.createLog(c, 'transferGame', 'games', 500, fromUserId);
      return this.sendError(c, 500, 'Error transferring game', error);
    }
  }

  @httpGet('/:gameId/can-transfer', LoggedCheck)
  public async canTransferGame(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
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
    } catch (error) {
      await this.createLog(c, 'canTransferGame', 'games', 500, fromUserId);
      return this.sendError(c, 500, 'Error checking transfer eligibility', error);
    }
  }

  // Download endpoints: implementation depends on your file serving strategy with Hono.
  // You may need to use c.res for streaming, or return a redirect to a signed URL.

  @httpGet('/:gameId/download', LoggedCheck)
  public async downloadGame(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const gameId = c.req.param('gameId');
    try {
      const game = await this.gameService.getGame(gameId);
      if (!game) return this.sendError(c, 404, 'Game not found');
      const owns = (await this.gameService.userOwnsGame(gameId, user.user_id)) || game.owner_id === user.user_id;
      if (!owns) return this.sendError(c, 403, 'Access denied');
      const link = game.download_link;
      if (!link) return this.sendError(c, 404, 'Download link not available');
      // For Hono, you may want to redirect or proxy the file
      return c.redirect(link);
    } catch (error) {
      return this.sendError(c, 500, 'Error downloading game', error);
    }
  }

  @httpHead('/:gameId/download', LoggedCheck)
  public async headDownloadGame(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const gameId = c.req.param('gameId');
    try {
      const game = await this.gameService.getGame(gameId);
      if (!game) return this.sendError(c, 404, 'Game not found');
      const owns = (await this.gameService.userOwnsGame(gameId, user.user_id)) || game.owner_id === user.user_id;
      if (!owns) return this.sendError(c, 403, 'Access denied');
      const link = game.download_link;
      if (!link) return this.sendError(c, 404, 'Download link not available');
      // For Hono, you may want to return headers or redirect
      return c.redirect(link);
    } catch (error) {
      return this.sendError(c, 500, 'Error fetching file headers', error);
    }
  }
}


