/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono';
import { inject, injectable } from 'inversify';
import { LoggedCheck } from 'middlewares/LoggedCheck';
import { describe } from '../decorators/describe';
import { controller, httpGet, httpPost } from '../hono-inversify';
import { User } from '../interfaces/User';
import { createRateLimit } from '../middlewares/hono/rateLimit';
import { ILogService } from '../services/LogService';
import { IStudioService } from '../services/StudioService';

const createStudioRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 3, 
  message: 'Too many studio creations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const addUserToStudioRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10, 
  message: 'Too many add user requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const removeUserFromStudioRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10, 
  message: 'Too many remove user requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

@injectable()
@controller('/studios')
export class Studios {
  constructor(
    @inject('StudioService') private studioService: IStudioService,
    @inject('LogService') private logService: ILogService
  ) {}

  private sendError(c: Context, status: number, message: string, error?: string) {
    const response: any = { message };
    if (error) {
      response.error = error;
    }
    return c.json(response, status as any);
  }

  private async createLog(c: Context, action: string, tableName?: string, statusCode?: number, userId?: string, metadata?: object, body?: any) {
    try {
      let requestBody: any = body || { note: 'Body not provided for logging' };
      
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
        controller: `StudioController.${action}`,
        original_path: c.req.path,
        http_method: c.req.method,
        request_body: JSON.stringify(requestBody),
        user_id: userId,
        status_code: statusCode,
      });
    } catch (error) {
      console.error('Error creating log:', error);
    }
  }

  // Helper pour récupérer l'utilisateur authentifié depuis le context
  private getUserFromContext(c: Context) {
    return c.get('user') as User | undefined;
  }

  private async getStudioOrError(studioId: string, c: Context, userId?: string) {
    const studio = await this.studioService.getStudio(studioId);
    if (!studio) {
      await this.createLog(c, 'getStudioOrError', 'studios', 404, userId, { studio_id: studioId });
      return null;
    }
    return studio;
  }

  @describe({
    endpoint: '/studios',
    method: 'POST',
    description: 'Create a new studio.',
    body: { studioName: 'Name of the studio' },
    responseType: { message: 'string' },
    example: 'POST /api/studios {"studioName": "My Studio"}',
    requiresAuth: true,
  })
  @httpPost('/', LoggedCheck, createStudioRateLimit)
  async createStudio(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user) {
        await this.createLog(c, 'createStudio', 'studios', 401);
        return this.sendError(c, 401, 'Unauthorized');
      }

      if (user.isStudio) {
        await this.createLog(c, 'createStudio', 'studios', 403, user.user_id, {
          reason: 'studio_cannot_create_studio',
        });
        return this.sendError(c, 403, "A studio can't create another studio");
      }

      const body = await c.req.json();
      const { studioName } = body;
      
      if (!studioName) {
        await this.createLog(c, 'createStudio', 'studios', 400, user.user_id, undefined, body);
        return this.sendError(c, 400, 'Missing required fields');
      }

      await this.studioService.createStudio(studioName, user.user_id);
      await this.createLog(c, 'createStudio', 'studios', 201, user.user_id, {
        studio_name: studioName,
      }, body);
      
      return c.json({ message: 'Studio created' }, 201);
    } catch (error) {
      console.error('Error creating studio:', error);
      const user = this.getUserFromContext(c);
      const body = await c.req.json().catch(() => ({}));
      await this.createLog(c, 'createStudio', 'studios', 500, user?.user_id, {
        error: error instanceof Error ? error.message : String(error),
      }, body);
      return this.sendError(c, 500, 'Error creating studio', error instanceof Error ? error.message : String(error));
    }
  }

  @describe({
    endpoint: '/studios/:studioId',
    method: 'GET',
    description: 'Get a studio by studioId',
    params: { studioId: 'The ID of the studio to retrieve' },
    responseType: {
      user_id: 'string',
      username: 'string',
      verified: 'boolean',
      admin_id: 'string',
      users: [
        {
          user_id: 'string',
          username: 'string',
          verified: 'boolean',
          admin: 'boolean',
        },
      ],
    },
    example: 'GET /api/studios/studio123',
  })
  @httpGet('/:studioId')
  async getStudio(c: Context) {
    try {
      const { studioId } = c.req.param();
      const studio = await this.getStudioOrError(studioId, c);
      
      if (!studio) {
        return this.sendError(c, 404, 'Studio not found');
      }

      await this.createLog(c, 'getStudio', 'studios', 200, undefined, {
        studio_id: studioId,
        users_count: studio.users?.length || 0,
      });
      
      return c.json(studio, 200);
    } catch (error) {
      console.error('Error fetching studio:', error);
      const { studioId } = c.req.param();
      await this.createLog(c, 'getStudio', 'studios', 500, undefined, {
        studio_id: studioId,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.sendError(c, 500, 'Error fetching studio', error instanceof Error ? error.message : String(error));
    }
  }

  @describe({
    endpoint: '/studios/user/@me',
    method: 'GET',
    description: 'Get all studios the authenticated user is part of.',
    responseType: [
      {
        user_id: 'string',
        username: 'string',
        verified: 'boolean',
        admin_id: 'string',
        isAdmin: 'boolean',
        apiKey: 'string',
        users: [
          {
            user_id: 'string',
            username: 'string',
            verified: 'boolean',
            admin: 'boolean',
          },
        ],
      },
    ],
    example: 'GET /api/studios/user/@me',
    requiresAuth: true,
  })
  @httpGet('/user/@me')
  async getMyStudios(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user) {
        await this.createLog(c, 'getMyStudios', 'studios', 401);
        return this.sendError(c, 401, 'Unauthorized');
      }

      const studios = await this.studioService.getUserStudios(user.user_id);
      await this.createLog(c, 'getMyStudios', 'studios', 200, user.user_id, {
        studios_count: studios.length,
        user_studios: studios.map(s => ({ id: s.user_id, isAdmin: s.isAdmin })),
      });
      
      return c.json(studios, 200);
    } catch (error) {
      console.error('Error fetching user studios:', error);
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'getMyStudios', 'studios', 500, user?.user_id, {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.sendError(c, 500, 'Error fetching user studios', error instanceof Error ? error.message : String(error));
    }
  }

  private async checkStudioAdmin(c: Context, user: User, studioId: string) {
    const studio = await this.getStudioOrError(studioId, c, user.user_id);
    if (!studio) return null;
    
    if (studio.admin_id !== user.user_id) {
      await this.createLog(c, 'checkStudioAdmin', 'studio_users', 403, user.user_id, {
        studio_id: studioId,
        reason: 'not_admin',
        studio_admin_id: studio.admin_id,
      });
      return null;
    }
    return studio;
  }

  @describe({
    endpoint: '/studios/:studioId/add-user',
    method: 'POST',
    description: 'Add a user to a studio.',
    params: { studioId: 'The ID of the studio' },
    body: { userId: 'The ID of the user to add' },
    responseType: { message: 'string' },
    example: 'POST /api/studios/studio123/add-user {"userId": "user456"}',
    requiresAuth: true,
  })
  @httpPost('/:studioId/add-user', LoggedCheck, addUserToStudioRateLimit)
  async addUserToStudio(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user) {
        await this.createLog(c, 'addUserToStudio', 'studio_users', 401);
        return this.sendError(c, 401, 'Unauthorized');
      }

      const { studioId } = c.req.param();
      const body = await c.req.json();
      const { userId } = body;
      
      if (!userId) {
        await this.createLog(c, 'addUserToStudio', 'studio_users', 400, user.user_id, {
          studio_id: studioId,
          reason: 'missing_user_id',
        }, body);
        return this.sendError(c, 400, 'Missing userId');
      }

      const targetUser = await this.studioService.getUser(userId);
      if (!targetUser) {
        await this.createLog(c, 'addUserToStudio', 'studio_users', 404, user.user_id, {
          studio_id: studioId,
          target_user_id: userId,
          reason: 'user_not_found',
        }, body);
        return this.sendError(c, 404, 'User not found');
      }

      const studio = await this.checkStudioAdmin(c, user, studioId);
      if (!studio) {
        return this.sendError(c, 403, 'Only the studio admin can modify users');
      }

      await this.studioService.addUserToStudio(studioId, targetUser);
      await this.createLog(c, 'addUserToStudio', 'studio_users', 200, user.user_id, {
        studio_id: studioId,
        target_user_id: userId,
        target_username: targetUser.username,
      }, body);
      
      return c.json({ message: 'User added to studio' }, 200);
    } catch (error) {
      console.error('Error adding user to studio:', error);
      const user = this.getUserFromContext(c);
      const { studioId } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      await this.createLog(c, 'addUserToStudio', 'studio_users', 500, user?.user_id, {
        studio_id: studioId,
        error: error instanceof Error ? error.message : String(error),
      }, body);
      return this.sendError(c, 500, 'Error adding user to studio', error instanceof Error ? error.message : String(error));
    }
  }

  @describe({
    endpoint: '/studios/:studioId/remove-user',
    method: 'POST',
    description: 'Remove a user from a studio.',
    params: { studioId: 'The ID of the studio' },
    body: { userId: 'The ID of the user to remove' },
    responseType: { message: 'string' },
    example: 'POST /api/studios/studio123/remove-user {"userId": "user456"}',
    requiresAuth: true,
  })
  @httpPost('/:studioId/remove-user', LoggedCheck, removeUserFromStudioRateLimit)
  async removeUserFromStudio(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user) {
        await this.createLog(c, 'removeUserFromStudio', 'studio_users', 401);
        return this.sendError(c, 401, 'Unauthorized');
      }

      const { studioId } = c.req.param();
      const body = await c.req.json();
      const { userId } = body;
      
      if (!userId) {
        await this.createLog(c, 'removeUserFromStudio', 'studio_users', 400, user.user_id, {
          studio_id: studioId,
          reason: 'missing_user_id',
        }, body);
        return this.sendError(c, 400, 'Missing userId');
      }

      const studio = await this.checkStudioAdmin(c, user, studioId);
      if (!studio) {
        return this.sendError(c, 403, 'Only the studio admin can modify users');
      }

      if (studio.admin_id === userId) {
        await this.createLog(c, 'removeUserFromStudio', 'studio_users', 403, user.user_id, {
          studio_id: studioId,
          target_user_id: userId,
          reason: 'cannot_remove_admin',
        }, body);
        return this.sendError(c, 403, 'Cannot remove the studio admin');
      }

      await this.studioService.removeUserFromStudio(studioId, userId);
      await this.createLog(c, 'removeUserFromStudio', 'studio_users', 200, user.user_id, {
        studio_id: studioId,
        target_user_id: userId,
      }, body);
      
      return c.json({ message: 'User removed from studio' }, 200);
    } catch (error) {
      console.error('Error removing user from studio:', error);
      const user = this.getUserFromContext(c);
      const { studioId } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      await this.createLog(c, 'removeUserFromStudio', 'studio_users', 500, user?.user_id, {
        studio_id: studioId,
        error: error instanceof Error ? error.message : String(error),
      }, body);
      return this.sendError(c, 500, 'Error removing user from studio', error instanceof Error ? error.message : String(error));
    }
  }
}


