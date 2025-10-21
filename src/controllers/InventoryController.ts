/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono';
import { inject, injectable } from 'inversify';
import { controller, httpGet } from '../hono-inversify';
import { LoggedCheck } from '../middlewares/LoggedCheck';
import { IInventoryService } from '../services/InventoryService';
import { ILogService } from '../services/LogService';

@injectable()
@controller('/inventory')
export class Inventories {
  constructor(
    @inject('InventoryService') private inventoryService: IInventoryService,
    @inject('LogService') private logService: ILogService
  ) {}

  private async createLog(c: Context, action: string, tableName?: string, statusCode?: number, userId?: string, metadata?: object) {
    try {
      const clientIP = c.req.header('cf-connecting-ip') ||
        c.req.header('x-forwarded-for') ||
        c.req.header('x-real-ip') ||
        'unknown';
      await this.logService.createLog({
        ip_address: clientIP,
        table_name: tableName,
        controller: `InventoryController.${action}`,
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

  @httpGet('/@me', LoggedCheck)
  public async getMyInventory(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) {
      await this.createLog(c, 'getMyInventory', 'inventory', 401);
      return this.sendError(c, 401, 'Unauthorized');
    }
    try {
      const inventory = await this.inventoryService.getInventory(user.user_id);
      await this.createLog(c, 'getMyInventory', 'inventory', 200, user.user_id);
      return c.json(inventory);
    } catch (error) {
      await this.createLog(c, 'getMyInventory', 'inventory', 500, user.user_id);
      return this.sendError(c, 500, 'Error fetching inventory', error);
    }
  }

  @httpGet('/:userId')
  public async getInventory(c: Context) {
    const userId = c.req.param('userId');
    // Optionally validate userId here if needed
    try {
      const inventory = await this.inventoryService.getInventory(userId);
      await this.createLog(c, 'getInventory', 'inventory', 200, userId);
      return c.json(inventory);
    } catch (error) {
      await this.createLog(c, 'getInventory', 'inventory', 500, userId);
      return this.sendError(c, 500, 'Error fetching inventory', error);
    }
  }

  @httpGet('/:userId/item/:itemId/amount')
  public async getItemAmount(c: Context) {
    const userId = c.req.param('userId');
    const itemId = c.req.param('itemId');
    try {
      const correctedUserId = await this.inventoryService.getCorrectedUserId(userId);
      const repo = this.inventoryService.getInventoryRepository();
      const amount = await repo.getItemAmount(correctedUserId, itemId);
      return c.json({ userId, itemId, amount });
    } catch (error) {
      return this.sendError(c, 500, 'Error fetching item amount', error);
    }
  }

  @httpGet('/')
  public async getAllInventories(c: Context) {
    await this.createLog(c, 'getAllInventories', 'inventory', 400);
    return c.json({ message: 'Please specify /api/inventory/<userId>' });
  }
}
