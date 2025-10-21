/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Context } from 'hono';
import { controller, httpGet } from '../hono-inversify';
import { inject, injectable } from 'inversify';
import { ILogService } from '../services/LogService';

@injectable()
@controller('/logs')
export class LogController {
  constructor(@inject('LogService') private logService: ILogService) {}

  private getUserFromContext(c: Context) {
    return c.get('user');
  }

  private sendError(c: Context, status: number, message: string) {
    return c.json({ message }, status as any);
  }

  @httpGet('/')
  public async getAllLogs(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user?.admin) {
      return this.sendError(c, 403, 'Admin access required');
    }
    try {
      const limit = parseInt(c.req.query('limit') || '100');
      const offset = parseInt(c.req.query('offset') || '0');
      const logs = await this.logService.getLogs(limit, offset);
      return c.json(logs);
    } catch (error) {
      return this.sendError(c, 500, 'Error fetching logs');
    }
  }

  @httpGet('/controller/:controller')
  public async getLogsByController(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user?.admin) {
      return this.sendError(c, 403, 'Admin access required');
    }
    try {
      const controller = c.req.param('controller');
      const limit = parseInt(c.req.query('limit') || '100');
      const logs = await this.logService.getLogsByController(controller, limit);
      return c.json(logs);
    } catch (error) {
      return this.sendError(c, 500, 'Error fetching logs by controller');
    }
  }

  @httpGet('/user/:userId')
  public async getLogsByUser(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user?.admin) {
      return this.sendError(c, 403, 'Admin access required');
    }
    try {
      const userId = c.req.param('userId');
      const limit = parseInt(c.req.query('limit') || '100');
      const logs = await this.logService.getLogsByUser(userId, limit);
      return c.json(logs);
    } catch (error) {
      return this.sendError(c, 500, 'Error fetching logs by user');
    }
  }

  @httpGet('/table/:tableName')
  public async getLogsByTable(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user?.admin) {
      return this.sendError(c, 403, 'Admin access required');
    }
    try {
      const tableName = c.req.param('tableName');
      const limit = parseInt(c.req.query('limit') || '100');
      const logs = await this.logService.getLogsByTable(tableName, limit);
      return c.json(logs);
    } catch (error) {
      return this.sendError(c, 500, 'Error fetching logs by table');
    }
  }

  @httpGet('/stats')
  public async getLogStats(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user?.admin) {
      return this.sendError(c, 403, 'Admin access required');
    }
    try {
      const stats = await this.logService.getLogStats();
      return c.json(stats);
    } catch (error) {
      return this.sendError(c, 500, 'Error fetching log statistics');
    }
  }

  @httpGet('/@me')
  public async getMyLogs(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) {
      return this.sendError(c, 401, 'Unauthorized');
    }
    try {
      const limit = parseInt(c.req.query('limit') || '100');
      const logs = await this.logService.getLogsByUser(user.user_id, limit);
      return c.json(logs);
    } catch (error) {
      return this.sendError(c, 500, 'Error fetching user logs');
    }
  }
}
