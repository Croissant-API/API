import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost } from 'inversify-express-utils';
import { describe } from '../decorators/describe';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { ILogService } from '../services/LogService';
import { IStudioService } from '../services/StudioService';

@controller('/studios')
export class Studios {
  constructor(
    @inject('StudioService') private studioService: IStudioService,
    @inject('LogService') private logService: ILogService
  ) {}

  private async createLog(req: Request, tableName?: string, statusCode?: number, userId?: string, metadata?: object) {
    try {
      const requestBody = { ...req.body, ...(metadata && { metadata }) };
      await this.logService.createLog({
        ip_address: (req.headers['x-real-ip'] as string) || (req.socket.remoteAddress as string),
        table_name: tableName,
        controller: 'StudioController',
        original_path: req.originalUrl,
        http_method: req.method,
        request_body: requestBody,
        user_id: userId ?? ((req as AuthenticatedRequest).user?.user_id as string),
        status_code: statusCode,
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  private async handleError(res: Response, req: Request, table: string, status: number, error: unknown, msg: string) {
    await this.createLog(req, table, status);
    res.status(status).send({ message: msg, error: error instanceof Error ? error.message : String(error) });
  }

  private async getStudioOrError(studioId: string, req: Request, res: Response) {
    const studio = await this.studioService.getStudio(studioId);
    if (!studio) {
      await this.createLog(req, 'studios', 404);
      res.status(404).send({ message: 'Studio not found' });
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
  @httpPost('/', LoggedCheck.middleware)
  async createStudio(req: AuthenticatedRequest, res: Response) {
    if (req.user.isStudio) return res.status(403).send({ message: "A studio can't create another studio" });
    const { studioName } = req.body;
    if (!studioName) return res.status(400).send({ message: 'Missing required fields' });
    try {
      await this.studioService.createStudio(studioName, req.user.user_id);
      await this.createLog(req, 'studios', 201);
      res.status(201).send({ message: 'Studio created' });
    } catch (error) {
      await this.handleError(res, req, 'studios', 500, error, 'Error creating studio');
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
  async getStudio(req: Request, res: Response) {
    try {
      const studio = await this.getStudioOrError(req.params.studioId, req, res);
      if (!studio) return;
      await this.createLog(req, 'studios', 200);
      res.send(studio);
    } catch (error) {
      await this.handleError(res, req, 'studios', 500, error, 'Error fetching studio');
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
  @httpGet('/user/@me', LoggedCheck.middleware)
  async getMyStudios(req: AuthenticatedRequest, res: Response) {
    try {
      const studios = await this.studioService.getUserStudios(req.user.user_id);
      await this.createLog(req, 'studios', 200);
      res.send(studios);
    } catch (error) {
      await this.handleError(res, req, 'studios', 500, error, 'Error fetching user studios');
    }
  }

  private async checkStudioAdmin(req: AuthenticatedRequest, res: Response, studioId: string) {
    const studio = await this.getStudioOrError(studioId, req, res);
    if (!studio) return null;
    if (studio.admin_id !== req.user.user_id) {
      await this.createLog(req, 'studio_users', 403);
      res.status(403).send({ message: 'Only the studio admin can modify users' });
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
  @httpPost('/:studioId/add-user', LoggedCheck.middleware)
  async addUserToStudio(req: AuthenticatedRequest, res: Response) {
    const { studioId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).send({ message: 'Missing userId' });
    try {
      const user = await this.studioService.getUser(userId);
      if (!user) return res.status(404).send({ message: 'User not found' });
      const studio = await this.checkStudioAdmin(req, res, studioId);
      if (!studio) return;
      await this.studioService.addUserToStudio(studioId, user);
      await this.createLog(req, 'studio_users', 200);
      res.send({ message: 'User added to studio' });
    } catch (error) {
      await this.handleError(res, req, 'studio_users', 500, error, 'Error adding user to studio');
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
  @httpPost('/:studioId/remove-user', LoggedCheck.middleware)
  async removeUserFromStudio(req: AuthenticatedRequest, res: Response) {
    const { studioId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).send({ message: 'Missing userId' });
    try {
      const studio = await this.checkStudioAdmin(req, res, studioId);
      if (!studio) return;
      if (studio.admin_id === userId) return res.status(403).send({ message: 'Cannot remove the studio admin' });
      await this.studioService.removeUserFromStudio(studioId, userId);
      await this.createLog(req, 'studio_users', 200);
      res.send({ message: 'User removed from studio' });
    } catch (error) {
      await this.handleError(res, req, 'studio_users', 500, error, 'Error removing user from studio');
    }
  }
}
