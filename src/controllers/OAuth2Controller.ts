import type { Request, Response } from 'express';
import { inject } from 'inversify';
import { describe } from '../decorators/describe';
import { controller, httpDelete, httpGet, httpPatch, httpPost } from '../hono-inversify';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { ILogService } from '../services/LogService';
import { IOAuth2Service } from '../services/OAuth2Service';
import { genVerificationKey } from '../utils/GenKey';
const rateLimit: any = () => undefined;

const createOAuth2AppRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 5, 
  message: 'Too many OAuth2 app creations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const updateOAuth2AppRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10, 
  message: 'Too many OAuth2 app updates, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const deleteOAuth2AppRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 5, 
  message: 'Too many OAuth2 app deletions, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authorizeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 200, 
  message: 'Too many authorization requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

function handleError(res: Response, error: unknown, message: string, status = 500) {
  const msg = error instanceof Error ? error.message : String(error);
  res.status(status).send({ message, error: msg });
}

@controller('/oauth2')
export class OAuth2 {
  constructor(
    @inject('OAuth2Service') private oauth2Service: IOAuth2Service,
    @inject('LogService') private logService: ILogService
  ) {}

  private async createLog(req: Request, tableName: string, statusCode?: number, userId?: string, metadata?: object) {
    try {
      const requestBody = { ...req.body };
      if (metadata) requestBody.metadata = metadata;
      await this.logService.createLog({
        ip_address: (req.headers['x-real-ip'] as string) || (req.socket.remoteAddress as string),
        table_name: tableName,
        controller: 'OAuth2Controller',
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

  @describe({
    endpoint: '/oauth2/app/:client_id',
    method: 'GET',
    description: 'Get an OAuth2 app by client_id',
    params: { client_id: 'The client_id of the app' },
    responseType: {
      client_id: 'string',
      client_secret: 'string',
      name: 'string',
      redirect_urls: ['string'],
    },
    example: 'GET /api/oauth2/app/123',
  })
  @httpGet('/app/:client_id')
  async getAppByClientId(req: Request, res: Response) {
    const { client_id } = req.params;
    try {
      const app = await this.oauth2Service.getAppByClientId(client_id as string);
      if (!app) {
        await this.createLog(req, 'oauth2_apps', 404, undefined, { client_id });
        return res.status(404).send({ message: 'App not found' });
      }
      await this.createLog(req, 'oauth2_apps', 200, undefined, { client_id, app_name: app.name });
      res.send(app);
    } catch (error) {
      await this.createLog(req, 'oauth2_apps', 500, undefined, {
        client_id,
        error: error instanceof Error ? error.message : String(error),
      });
      handleError(res, error, 'Error fetching app');
    }
  }

  @describe({
    endpoint: '/oauth2/app',
    method: 'POST',
    description: 'Create a new OAuth2 app',
    body: {
      name: 'Name of the app',
      redirect_urls: 'Array of redirect URLs',
    },
    responseType: {
      client_id: 'string',
      client_secret: 'string',
    },
    example: 'POST /api/oauth2/app {"name": "My App", "redirect_urls": ["https://example.com/callback"]}',
    requiresAuth: true,
  })
  @httpPost('/app', LoggedCheck.middleware, createOAuth2AppRateLimit)
  async createApp(req: AuthenticatedRequest, res: Response) {
    const { name, redirect_urls } = req.body;
    if (!name || !redirect_urls || !Array.isArray(redirect_urls)) {
      await this.createLog(req, 'oauth2_apps', 400, req.user.user_id, { reason: 'invalid_request_body' });
      return res.status(400).send({ message: 'Invalid request body' });
    }
    try {
      const app = await this.oauth2Service.createApp(req.user.user_id, name, redirect_urls);
      await this.createLog(req, 'oauth2_apps', 201, req.user.user_id, {
        app_name: name,
        client_id: app.client_id,
        redirect_urls_count: redirect_urls.length,
      });
      res.status(201).send({
        client_id: app.client_id,
        client_secret: app.client_secret,
      });
    } catch (error) {
      await this.createLog(req, 'oauth2_apps', 500, req.user.user_id, {
        app_name: name,
        error: error instanceof Error ? error.message : String(error),
      });
      handleError(res, error, 'Error creating app');
    }
  }

  @describe({
    endpoint: '/oauth2/apps',
    method: 'GET',
    description: 'Get all OAuth2 apps owned by the authenticated user',
    responseType: [
      {
        client_id: 'string',
        client_secret: 'string',
        name: 'string',
        redirect_urls: ['string'],
      },
    ],
    example: 'GET /api/oauth2/apps',
    requiresAuth: true,
  })
  @httpGet('/apps', LoggedCheck.middleware)
  async getMyApps(req: AuthenticatedRequest, res: Response) {
    try {
      const apps = await this.oauth2Service.getAppsByOwner(req.user.user_id);
      await this.createLog(req, 'oauth2_apps', 200, req.user.user_id, { apps_count: apps.length });
      res.send(apps);
    } catch (error) {
      await this.createLog(req, 'oauth2_apps', 500, req.user.user_id, {
        error: error instanceof Error ? error.message : String(error),
      });
      handleError(res, error, 'Error fetching apps');
    }
  }

  @describe({
    endpoint: '/oauth2/app/:client_id',
    method: 'PATCH',
    description: 'Update an OAuth2 app',
    params: { client_id: 'The client_id of the app' },
    body: {
      name: 'Name of the app (optional)',
      redirect_urls: 'Array of redirect URLs (optional)',
    },
    responseType: { success: 'boolean' },
    example: 'PATCH /api/oauth2/app/123 {"name": "Updated App"}',
    requiresAuth: true,
  })
  @httpPatch('/app/:client_id', LoggedCheck.middleware, updateOAuth2AppRateLimit)
  async updateApp(req: AuthenticatedRequest, res: Response) {
    const { client_id } = req.params;
    const { name, redirect_urls } = req.body;
    try {
      await this.oauth2Service.updateApp(client_id as string, req.user.user_id, {
        name,
        redirect_urls,
      });
      await this.createLog(req, 'oauth2_apps', 200, req.user.user_id, {
        client_id,
        updated_fields: {
          name: name ? true : false,
          redirect_urls: redirect_urls ? true : false,
        },
      });
      res.status(200).send({ success: true });
    } catch (error) {
      await this.createLog(req, 'oauth2_apps', 500, req.user.user_id, {
        client_id,
        error: error instanceof Error ? error.message : String(error),
      });
      handleError(res, error, 'Error updating app');
    }
  }

  @describe({
    endpoint: '/oauth2/app/:client_id',
    method: 'DELETE',
    description: 'Delete an OAuth2 app',
    params: { client_id: 'The client_id of the app' },
    responseType: { message: 'string' },
    example: 'DELETE /api/oauth2/app/123',
    requiresAuth: true,
  })
  @httpDelete('/app/:client_id', LoggedCheck.middleware, deleteOAuth2AppRateLimit)
  async deleteApp(req: AuthenticatedRequest, res: Response) {
    const { client_id } = req.params;
    try {
      await this.oauth2Service.deleteApp(client_id as string, req.user.user_id);
      await this.createLog(req, 'oauth2_apps', 204, req.user.user_id, { client_id });
      res.status(204).send();
    } catch (error) {
      await this.createLog(req, 'oauth2_apps', 500, req.user.user_id, {
        client_id,
        error: error instanceof Error ? error.message : String(error),
      });
      handleError(res, error, 'Error deleting app');
    }
  }

  @describe({
    endpoint: '/oauth2/authorize',
    method: 'GET',
    description: 'Authorize a user for an OAuth2 app',
    query: {
      client_id: 'The client_id of the app',
      redirect_uri: 'The redirect URI',
    },
    responseType: { code: 'string' },
    example: 'GET /api/oauth2/authorize?client_id=123&redirect_uri=https://example.com/callback',
    requiresAuth: true,
  })
  @httpGet('/authorize', LoggedCheck.middleware, authorizeRateLimit)
  async authorize(req: AuthenticatedRequest, res: Response) {
    const { client_id, redirect_uri } = req.query as { client_id: string; redirect_uri: string };
    const userId = req.user?.user_id;

    if (!userId) {
      await this.createLog(req, 'oauth2_authorizations', 401, undefined, { reason: 'no_user_id' });
      return res.status(401).send({ message: 'Unauthorized' });
    }

    if (!client_id || !redirect_uri) {
      await this.createLog(req, 'oauth2_authorizations', 400, userId, {
        reason: 'missing_parameters',
        has_client_id: !!client_id,
        has_redirect_uri: !!redirect_uri,
      });
      return res.status(400).send({ message: 'Missing client_id or redirect_uri' });
    }

    try {
      const code = await this.oauth2Service.generateAuthCode(client_id, redirect_uri, userId);
      await this.createLog(req, 'oauth2_authorizations', 200, userId, {
        client_id,
        redirect_uri,
        code_generated: true,
      });
      res.send({ code });
    } catch (error) {
      await this.createLog(req, 'oauth2_authorizations', 500, userId, {
        client_id,
        redirect_uri,
        error: error instanceof Error ? error.message : String(error),
      });
      handleError(res, error, 'Error generating authorization code');
    }
  }

  @describe({
    endpoint: '/oauth2/user',
    method: 'GET',
    description: 'Get user information by authorization code',
    query: {
      code: 'The authorization code',
      client_id: 'The client_id of the app',
    },
    responseType: {
      username: 'string',
      user_id: 'string',
      email: 'string',
      balance: 'number',
      verified: 'boolean',
      steam_username: 'string',
      steam_avatar_url: 'string',
      steam_id: 'string',
      discord_id: 'string',
      google_id: 'string',
      verificationKey: 'string',
    },
    example: 'GET /api/oauth2/user?code=abc123&client_id=456',
  })
  @httpGet('/user')
  async getUserByCode(req: Request, res: Response) {
    const { code, client_id } = req.query as { code: string; client_id: string };

    if (!code || !client_id) {
      await this.createLog(req, 'oauth2_user_access', 400, undefined, {
        reason: 'missing_parameters',
        has_code: !!code,
        has_client_id: !!client_id,
      });
      return res.status(400).send({ message: 'Missing code or client_id' });
    }

    try {
      const user = await this.oauth2Service.getUserByCode(code, client_id);
      if (!user) {
        await this.createLog(req, 'oauth2_user_access', 404, undefined, {
          client_id,
          code_provided: true,
        });
        return res.status(404).send({ message: 'User not found' });
      }

      await this.createLog(req, 'oauth2_user_access', 200, user.user_id, {
        client_id,
        user_id: user.user_id,
        username: user.username,
      });
      res.send({ ...user, verificationKey: genVerificationKey(user.user_id) });
    } catch (error) {
      await this.createLog(req, 'oauth2_user_access', 500, undefined, {
        client_id,
        error: error instanceof Error ? error.message : String(error),
      });
      handleError(res, error, 'Error fetching user');
    }
  }
}


