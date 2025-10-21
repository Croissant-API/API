/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono';
import { controller, httpDelete, httpGet, httpPatch, httpPost } from 'hono-inversify';
import { inject, injectable } from 'inversify';
import { LoggedCheck } from 'middlewares/LoggedCheck';
import { describe } from '../decorators/describe';
import { createRateLimit } from '../middlewares/hono/rateLimit';
import { ILogService } from '../services/LogService';
import { IOAuth2Service } from '../services/OAuth2Service';
import { genVerificationKey } from '../utils/GenKey';

// Rate limit configs
const createAppRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many OAuth2 app creations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
const updateAppRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many OAuth2 app updates, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
const deleteAppRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many OAuth2 app deletions, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
const authorizeRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200,
  message: 'Too many authorization requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

function sendError(c: Context, status: number, message: string, error?: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return c.json({ message, error: msg }, status as any);
}

@injectable()
@controller('/oauth2')
export class OAuth2Controller {
  constructor(
    @inject('OAuth2Service') private oauth2Service: IOAuth2Service,
    @inject('LogService') private logService: ILogService
  ) {}

  private async createLog(c: Context, tableName: string, statusCode?: number, userId?: string, metadata?: object, body?: any) {
    try {
      let requestBody: any = body || {};
      if (metadata) requestBody = { ...requestBody, metadata };
      const clientIP = c.req.header('cf-connecting-ip') ||
        c.req.header('x-forwarded-for') ||
        c.req.header('x-real-ip') ||
        'unknown';
      await this.logService.createLog({
        ip_address: clientIP,
        table_name: tableName,
        controller: 'OAuth2Controller',
        original_path: c.req.path,
        http_method: c.req.method,
        request_body: JSON.stringify(requestBody),
        user_id: userId,
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
  async getAppByClientId(c: Context) {
    const client_id = c.req.param('client_id');
    try {
      const app = await this.oauth2Service.getAppByClientId(client_id);
      if (!app) {
        await this.createLog(c, 'oauth2_apps', 404, undefined, { client_id });
        return c.json({ message: 'App not found' }, 404);
      }
      await this.createLog(c, 'oauth2_apps', 200, undefined, { client_id, app_name: app.name });
      return c.json(app, 200);
    } catch (error) {
      await this.createLog(c, 'oauth2_apps', 500, undefined, { client_id, error });
      return sendError(c, 500, 'Error fetching app', error);
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
  @httpPost('/app', LoggedCheck, createAppRateLimit)
  async createApp(c: Context) {
    const user = c.get('user');
    const { name, redirect_urls } = await c.req.json();
    if (!user || !name || !redirect_urls || !Array.isArray(redirect_urls)) {
      await this.createLog(c, 'oauth2_apps', 400, user?.user_id, { reason: 'invalid_request_body' });
      return c.json({ message: 'Invalid request body' }, 400);
    }
    try {
      const app = await this.oauth2Service.createApp(user.user_id, name, redirect_urls);
      await this.createLog(c, 'oauth2_apps', 201, user.user_id, {
        app_name: name,
        client_id: app.client_id,
        redirect_urls_count: redirect_urls.length,
      });
      return c.json({
        client_id: app.client_id,
        client_secret: app.client_secret,
      }, 201);
    } catch (error) {
      await this.createLog(c, 'oauth2_apps', 500, user.user_id, { app_name: name, error });
      return sendError(c, 500, 'Error creating app', error);
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
  @httpGet('/apps', LoggedCheck)
  async getMyApps(c: Context) {
    const user = c.get('user');
    if (!user) {
      return c.json({ message: 'Unauthorized' }, 401);
    }
    try {
      const apps = await this.oauth2Service.getAppsByOwner(user.user_id);
      await this.createLog(c, 'oauth2_apps', 200, user.user_id, { apps_count: apps.length });
      return c.json(apps, 200);
    } catch (error) {
      await this.createLog(c, 'oauth2_apps', 500, user.user_id, { error });
      return sendError(c, 500, 'Error fetching apps', error);
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
  @httpPatch('/app/:client_id', LoggedCheck, updateAppRateLimit)
  async updateApp(c: Context) {
    const user = c.get('user');
    const client_id = c.req.param('client_id');
    const { name, redirect_urls } = await c.req.json();
    if (!user) {
      return c.json({ message: 'Unauthorized' }, 401);
    }
    try {
      await this.oauth2Service.updateApp(client_id, user.user_id, { name, redirect_urls });
      await this.createLog(c, 'oauth2_apps', 200, user.user_id, {
        client_id,
        updated_fields: {
          name: !!name,
          redirect_urls: !!redirect_urls,
        },
      });
      return c.json({ success: true }, 200);
    } catch (error) {
      await this.createLog(c, 'oauth2_apps', 500, user.user_id, { client_id, error });
      return sendError(c, 500, 'Error updating app', error);
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
  @httpDelete('/app/:client_id', LoggedCheck, deleteAppRateLimit)
  async deleteApp(c: Context) {
    const user = c.get('user');
    const client_id = c.req.param('client_id');
    if (!user) {
      return c.json({ message: 'Unauthorized' }, 401);
    }
    try {
      await this.oauth2Service.deleteApp(client_id, user.user_id);
      await this.createLog(c, 'oauth2_apps', 200, user.user_id, { client_id });
      return c.json({ message: 'App deleted successfully' }, 200);
    } catch (error) {
      await this.createLog(c, 'oauth2_apps', 500, user.user_id, { client_id, error });
      return sendError(c, 500, 'Error deleting app', error);
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
  @httpGet('/authorize', LoggedCheck, authorizeRateLimit)
  async authorize(c: Context) {
    const user = c.get('user');
    const client_id = c.req.query('client_id');
    const redirect_uri = c.req.query('redirect_uri');
    if (!user) {
      await this.createLog(c, 'oauth2_authorizations', 401, undefined, { reason: 'no_user_id' });
      return c.json({ message: 'Unauthorized' }, 401);
    }
    if (!client_id || !redirect_uri) {
      await this.createLog(c, 'oauth2_authorizations', 400, user.user_id, {
        reason: 'missing_parameters',
        has_client_id: !!client_id,
        has_redirect_uri: !!redirect_uri,
      });
      return c.json({ message: 'Missing client_id or redirect_uri' }, 400);
    }
    try {
      const code = await this.oauth2Service.generateAuthCode(client_id, redirect_uri, user.user_id);
      await this.createLog(c, 'oauth2_authorizations', 200, user.user_id, {
        client_id,
        redirect_uri,
        code_generated: true,
      });
      return c.json({ code }, 200);
    } catch (error) {
      await this.createLog(c, 'oauth2_authorizations', 500, user.user_id, { client_id, redirect_uri, error });
      return sendError(c, 500, 'Error generating authorization code', error);
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
  async getUserByCode(c: Context) {
    const code = c.req.query('code');
    const client_id = c.req.query('client_id');
    if (!code || !client_id) {
      await this.createLog(c, 'oauth2_user_access', 400, undefined, {
        reason: 'missing_parameters',
        has_code: !!code,
        has_client_id: !!client_id,
      });
      return c.json({ message: 'Missing code or client_id' }, 400);
    }
    try {
      const user = await this.oauth2Service.getUserByCode(code, client_id);
      if (!user) {
        await this.createLog(c, 'oauth2_user_access', 404, undefined, { client_id, code_provided: true });
        return c.json({ message: 'User not found' }, 404);
      }
      await this.createLog(c, 'oauth2_user_access', 200, user.user_id, { client_id, user_id: user.user_id, username: user.username });
      return c.json({ ...user, verificationKey: genVerificationKey(user.user_id) }, 200);
    } catch (error) {
      await this.createLog(c, 'oauth2_user_access', 500, undefined, { client_id, error });
      return sendError(c, 500, 'Error fetching user', error);
    }
  }
}