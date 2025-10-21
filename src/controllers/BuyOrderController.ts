/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono';
import { inject, injectable } from 'inversify';
import { controller, httpGet, httpPost, httpPut } from '../hono-inversify';
import { LoggedCheck } from '../middlewares/LoggedCheck';
import { IBuyOrderService } from '../services/BuyOrderService';
import { IItemService } from '../services/ItemService';
import { ILogService } from '../services/LogService';

@injectable()
@controller('/buy-orders')
export class BuyOrderController {
  constructor(
    @inject('BuyOrderService') private buyOrderService: IBuyOrderService,
    @inject('ItemService') private itemService: IItemService,
    @inject('LogService') private logService: ILogService
  ) {}

  private async logAction(c: Context, action: string, statusCode: number, metadata?: object) {
    try {
      const requestBody = (await c.req.json().catch(() => ({}))) || {};
      if (metadata) Object.assign(requestBody, { metadata });
      await this.logService.createLog({
        ip_address: c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
        table_name: 'buy_order',
        controller: `BuyOrderController.${action}`,
        original_path: c.req.path,
        http_method: c.req.method,
        request_body: requestBody,
        user_id: this.getUserFromContext(c)?.user_id,
        status_code: statusCode,
      });
    } catch (error) {
      console.error('Error creating log:', error);
    }
  }

  private sendError(c: Context, status: number, message: string, error?: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return c.json({ message, error: msg }, status as any);
  }

  private getUserFromContext(c: Context) {
    return c.get('user');
  }

  @httpPost('/', LoggedCheck)
  public async createBuyOrder(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const { itemId, price } = await c.req.json();
    if (!itemId || typeof price !== 'number' || price < 1) {
      await this.logAction(c, 'createBuyOrder', 400);
      return this.sendError(c, 400, 'itemId and price are required');
    }
    const itemExists = await this.itemService.getItem(itemId);
    if (!itemExists) {
      await this.logAction(c, 'createBuyOrder', 404);
      return this.sendError(c, 404, 'Item not found');
    }
    try {
      const order = await this.buyOrderService.createBuyOrder(user.user_id, itemId, price);
      await this.logAction(c, 'createBuyOrder', 201);
      return c.json(order, 201);
    } catch (error) {
      await this.logAction(c, 'createBuyOrder', 500, { error });
      return this.sendError(c, 500, 'Error while creating buy order', error);
    }
  }

  @httpPut('/:id/cancel', LoggedCheck)
  public async cancelBuyOrder(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const orderId = c.req.param('id');
    try {
      await this.buyOrderService.cancelBuyOrder(orderId, user.user_id);
      await this.logAction(c, 'cancelBuyOrder', 200);
      return c.json({ message: 'Buy order cancelled' }, 200);
    } catch (error) {
      await this.logAction(c, 'cancelBuyOrder', 500, { error });
      return this.sendError(c, 500, 'Error while cancelling buy order', error);
    }
  }

  @httpGet('/user/:userId', LoggedCheck)
  public async getBuyOrdersByUser(c: Context) {
    const user = this.getUserFromContext(c);
    const userId = c.req.param('userId');
    if (!user || userId !== user.user_id) {
      await this.logAction(c, 'getBuyOrdersByUser', 403);
      return this.sendError(c, 403, 'Forbidden');
    }
    try {
      const orders = await this.buyOrderService.getBuyOrders({ userId });
      await this.logAction(c, 'getBuyOrdersByUser', 200);
      return c.json(orders);
    } catch (error) {
      await this.logAction(c, 'getBuyOrdersByUser', 500, { error });
      return this.sendError(c, 500, 'Error while fetching buy orders', error);
    }
  }

  @httpGet('/item/:itemId')
  public async getActiveBuyOrdersForItem(c: Context) {
    const itemId = c.req.param('itemId');
    try {
      const orders = await this.buyOrderService.getBuyOrders({ itemId, status: 'active' }, 'price DESC, created_at ASC');
      await this.logAction(c, 'getActiveBuyOrdersForItem', 200);
      return c.json(orders);
    } catch (error) {
      await this.logAction(c, 'getActiveBuyOrdersForItem', 500, { error });
      return this.sendError(c, 500, 'Error while fetching buy orders', error);
    }
  }
}
