import { Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet } from 'inversify-express-utils';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { ILogService } from '../services/LogService';

function handleError(res: Response, error: unknown, message: string, status = 500) {
  const msg = error instanceof Error ? error.message : String(error);
  res.status(status).send({ message, error: msg });
}

@controller('/logs')
export class LogController {
  constructor(@inject('LogService') private logService: ILogService) {}

  @httpGet('/', LoggedCheck.middleware)
  public async getAllLogs(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: 'Admin access required' });
    }

    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = await this.logService.getLogs(limit, offset);
      res.send(logs);
    } catch (error) {
      handleError(res, error, 'Error fetching logs');
    }
  }

  @httpGet('/controller/:controller', LoggedCheck.middleware)
  public async getLogsByController(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: 'Admin access required' });
    }

    try {
      const controller = req.params.controller as string;
      const limit = parseInt(req.query.limit as string) || 100;

      const logs = await this.logService.getLogsByController(controller, limit);
      res.send(logs);
    } catch (error) {
      handleError(res, error, 'Error fetching logs by controller');
    }
  }

  @httpGet('/user/:userId', LoggedCheck.middleware)
  public async getLogsByUser(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: 'Admin access required' });
    }

    try {
      const userId = req.params.userId as string;
      const limit = parseInt(req.query.limit as string) || 100;

      const logs = await this.logService.getLogsByUser(userId, limit);
      res.send(logs);
    } catch (error) {
      handleError(res, error, 'Error fetching logs by user');
    }
  }

  @httpGet('/table/:tableName', LoggedCheck.middleware)
  public async getLogsByTable(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: 'Admin access required' });
    }

    try {
      const tableName = req.params.tableName as string;
      const limit = parseInt(req.query.limit as string) || 100;

      const logs = await this.logService.getLogsByTable(tableName, limit);
      res.send(logs);
    } catch (error) {
      handleError(res, error, 'Error fetching logs by table');
    }
  }

  @httpGet('/stats', LoggedCheck.middleware)
  public async getLogStats(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: 'Admin access required' });
    }

    try {
      const stats = await this.logService.getLogStats();
      res.send(stats);
    } catch (error) {
      handleError(res, error, 'Error fetching log statistics');
    }
  }

  @httpGet('/@me', LoggedCheck.middleware)
  public async getMyLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;

      const logs = await this.logService.getLogsByUser(req.user.user_id, limit);
      res.send(logs);
    } catch (error) {
      handleError(res, error, 'Error fetching user logs');
    }
  }
}
