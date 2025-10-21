/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono';
import { inject, injectable } from 'inversify';
import { LoggedCheck } from 'middlewares/LoggedCheck';
import { v4 } from 'uuid';
import { describe } from '../decorators/describe';
import { controller, httpGet, httpPost } from '../hono-inversify';
import { createRateLimit } from '../middlewares/hono/rateLimit';
import { ILobbyService } from '../services/LobbyService';
import { ILogService } from '../services/LogService';

const createLobbyRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Too many lobby creations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const joinLobbyRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: 'Too many lobby joins, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const leaveLobbyRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: 'Too many lobby leaves, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

@injectable()
@controller('/lobbies')
export class Lobbies {
  constructor(
    @inject('LobbyService') private lobbyService: ILobbyService,
    @inject('LogService') private logService: ILogService
  ) {}

  private sendError(c: Context, status: number, message: string) {
    return c.json({ message }, status as any);
  }

  private async createLog(c: Context, action: string, tableName?: string, statusCode?: number, userId?: string, body?: any) {
    try {
      const clientIP = c.req.header('cf-connecting-ip') ||
        c.req.header('x-forwarded-for') ||
        c.req.header('x-real-ip') ||
        'unknown';
      await this.logService.createLog({
        ip_address: clientIP,
        table_name: tableName,
        controller: `LobbyController.${action}`,
        original_path: c.req.path,
        http_method: c.req.method,
        request_body: JSON.stringify(body || {}),
        user_id: userId,
        status_code: statusCode,
      });
    } catch (error) {
      console.error('Error creating log:', error);
    }
  }

  private getUserFromContext(c: Context) {
    return c.get('user');
  }

  @describe({
    endpoint: '/lobbies',
    method: 'POST',
    description: 'Create a new lobby.',
    responseType: { message: 'string' },
    example: 'POST /api/lobbies',
    requiresAuth: true,
  })
  @httpPost('/', LoggedCheck, createLobbyRateLimit)
  public async createLobby(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      if (!user) return this.sendError(c, 401, 'Unauthorized');
      const lobbyId = v4();
      await this.lobbyService.createLobby(lobbyId, [user.user_id]);
      await this.lobbyService.joinLobby(lobbyId, user.user_id);
      await this.createLog(c, 'createLobby', 'lobbies', 201, user.user_id);
      return c.json({ message: 'Lobby created' }, 201);
    } catch (error) {
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'createLobby', 'lobbies', 500, user?.user_id);
      return this.sendError(c, 500, 'Error creating lobby');
    }
  }

  @describe({
    endpoint: '/lobbies/:lobbyId',
    method: 'GET',
    description: 'Get a lobby by lobbyId',
    params: { lobbyId: 'The id of the lobby' },
    responseType: {
      lobbyId: 'string',
      users: [
        {
          username: 'string',
          user_id: 'string',
          verified: 'boolean',
          steam_username: 'string',
          steam_avatar_url: 'string',
          steam_id: 'string',
        },
      ],
    },
    example: 'GET /api/lobbies/123',
  })
  @httpGet('/:lobbyId')
  public async getLobby(c: Context) {
    const lobbyId = c.req.param('lobbyId');
    // Optionally validate lobbyId with lobbyIdParamSchema here
    try {
      const lobby = await this.lobbyService.getLobby(lobbyId);
      if (!lobby) {
        await this.createLog(c, 'getLobby', 'lobbies', 404);
        return this.sendError(c, 404, 'Lobby not found');
      }
      await this.createLog(c, 'getLobby', 'lobbies', 200);
      return c.json(lobby);
    } catch (error: any) {
      await this.createLog(c, 'getLobby', 'lobbies', 500);
      return this.sendError(c, 500, error?.message || 'Error fetching lobby');
    }
  }

  @describe({
    endpoint: '/lobbies/user/@me',
    method: 'GET',
    description: 'Get the lobby the authenticated user is in.',
    responseType: { success: 'boolean', lobbyId: 'string', users: ['string'] },
    example: 'GET /api/lobbies/user/@me',
    requiresAuth: true,
  })
  @httpGet('/user/@me', LoggedCheck)
  public async getMyLobby(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      if (!user) return this.sendError(c, 401, 'Unauthorized');
      const lobby = await this.lobbyService.getUserLobby(user.user_id);
      if (!lobby) {
        await this.createLog(c, 'getMyLobby', 'lobbies', 200, user.user_id);
        return c.json({ success: false, message: 'User is not in any lobby' });
      }
      await this.createLog(c, 'getMyLobby', 'lobbies', 200, user.user_id);
      return c.json({ success: true, ...lobby });
    } catch (error) {
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'getMyLobby', 'lobbies', 500, user?.user_id);
      return this.sendError(c, 500, 'Error fetching user lobby');
    }
  }

  @describe({
    endpoint: '/lobbies/user/:userId',
    method: 'GET',
    description: 'Get the lobby a user is in',
    params: { userId: 'The id of the user' },
    responseType: { lobbyId: 'string', users: ['string'] },
    example: 'GET /api/lobbies/user/123',
  })
  @httpGet('/user/:userId')
  public async getUserLobby(c: Context) {
    const userId = c.req.param('userId');
    // Optionally validate userId with userIdParamSchema here
    try {
      const lobby = await this.lobbyService.getUserLobby(userId);
      if (!lobby) {
        await this.createLog(c, 'getUserLobby', 'lobbies', 404, userId);
        return this.sendError(c, 404, 'User is not in any lobby');
      }
      await this.createLog(c, 'getUserLobby', 'lobbies', 200, userId);
      return c.json(lobby);
    } catch (error) {
      await this.createLog(c, 'getUserLobby', 'lobbies', 500, userId);
      return this.sendError(c, 500, 'Error fetching user lobby');
    }
  }

  @describe({
    endpoint: '/lobbies/:lobbyId/join',
    method: 'POST',
    description: 'Join a lobby. This will make the user leave all other lobbies first.',
    params: { lobbyId: 'The id of the lobby' },
    responseType: { message: 'string' },
    example: 'POST /api/lobbies/123/join',
    requiresAuth: true,
  })
  @httpPost('/:lobbyId/join', LoggedCheck, joinLobbyRateLimit)
  public async joinLobby(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const lobbyId = c.req.param('lobbyId');
    // Optionally validate lobbyId with lobbyIdParamSchema here
    try {
      await this.lobbyService.leaveAllLobbies(user.user_id);
      await this.lobbyService.joinLobby(lobbyId, user.user_id);
      await this.createLog(c, 'joinLobby', 'lobbies', 200, user.user_id);
      return c.json({ message: 'Joined lobby' });
    } catch (error) {
      await this.createLog(c, 'joinLobby', 'lobbies', 500, user.user_id);
      return this.sendError(c, 500, 'Error joining lobby');
    }
  }

  @describe({
    endpoint: '/lobbies/:lobbyId/leave',
    method: 'POST',
    description: 'Leave a lobby.',
    params: { lobbyId: 'The id of the lobby' },
    responseType: { message: 'string' },
    example: 'POST /api/lobbies/123/leave',
    requiresAuth: true,
  })
  @httpPost('/:lobbyId/leave', LoggedCheck, leaveLobbyRateLimit)
  public async leaveLobby(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const lobbyId = c.req.param('lobbyId');
    // Optionally validate lobbyId with lobbyIdParamSchema here
    try {
      await this.lobbyService.leaveLobby(lobbyId, user.user_id);
      await this.createLog(c, 'leaveLobby', 'lobbies', 200, user.user_id);
      return c.json({ message: 'Left lobby' });
    } catch (error) {
      await this.createLog(c, 'leaveLobby', 'lobbies', 500, user.user_id);
      return this.sendError(c, 500, 'Error leaving lobby');
    }
  }
}


