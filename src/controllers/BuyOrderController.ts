import { Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut } from 'inversify-express-utils';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { IBuyOrderService } from '../services/BuyOrderService';
import { IItemService } from '../services/ItemService';
import { ILogService } from '../services/LogService';

function handleError(res: Response, error: unknown, message: string, status = 500) {
  const msg = error instanceof Error ? error.message : String(error);
  res.status(status).send({ message, error: msg });
}

@controller('/buy-orders')
export class BuyOrderController {
  constructor(
    @inject('BuyOrderService') private buyOrderService: IBuyOrderService,
    @inject('ItemService') private itemService: IItemService,
    @inject('LogService') private logService: ILogService
  ) {}

  private async logAction(req: AuthenticatedRequest, action: string, statusCode: number, metadata?: object) {
    try {
      const requestBody = { ...req.body };
      if (metadata) requestBody.metadata = metadata;
      await this.logService.createLog({
        ip_address: (req.headers['x-real-ip'] as string) || (req.socket.remoteAddress as string),
        table_name: 'buy_order',
        controller: `BuyOrderController.${action}`,
        original_path: req.originalUrl,
        http_method: req.method,
        request_body: requestBody,
        user_id: req.user?.user_id,
        status_code: statusCode,
      });
    } catch (error) {
      console.error('Error creating log:', error);
    }
  }

  @httpPost('/', LoggedCheck.middleware)
  public async createBuyOrder(req: AuthenticatedRequest, res: Response) {
    const buyerId = req.user.user_id;
    const { itemId, price } = req.body;
    if (!itemId || typeof price !== 'number' || price < 1) {
      await this.logAction(req, 'createBuyOrder', 400);
      return res.status(400).send({ message: 'itemId and price are required' });
    }

    const itemExists = await this.itemService.getItem(itemId);

    if (!itemExists) {
      await this.logAction(req, 'createBuyOrder', 404);
      return res.status(404).send({ message: 'Item not found' });
    }

    try {
      const order = await this.buyOrderService.createBuyOrder(buyerId, itemId, price);
      await this.logAction(req, 'createBuyOrder', 201);
      res.status(201).send(order);
    } catch (error) {
      await this.logAction(req, 'createBuyOrder', 500, { error });
      handleError(res, error, 'Error while creating buy order');
    }
  }

  @httpPut('/:id/cancel', LoggedCheck.middleware)
  public async cancelBuyOrder(req: AuthenticatedRequest, res: Response) {
    const buyerId = req.user.user_id;
    const orderId = req.params.id;
    try {
      await this.buyOrderService.cancelBuyOrder(orderId, buyerId);
      await this.logAction(req, 'cancelBuyOrder', 200);
      res.status(200).send({ message: 'Buy order cancelled' });
    } catch (error) {
      await this.logAction(req, 'cancelBuyOrder', 500, { error });
      handleError(res, error, 'Error while cancelling buy order');
    }
  }

  @httpGet('/user/:userId', LoggedCheck.middleware)
  public async getBuyOrdersByUser(req: AuthenticatedRequest, res: Response) {
    const userId = req.params.userId;
    if (userId !== req.user.user_id) {
      await this.logAction(req, 'getBuyOrdersByUser', 403);
      return res.status(403).send({ message: 'Forbidden' });
    }
    try {
      const orders = await this.buyOrderService.getBuyOrders({ userId });
      await this.logAction(req, 'getBuyOrdersByUser', 200);
      res.send(orders);
    } catch (error) {
      await this.logAction(req, 'getBuyOrdersByUser', 500, { error });
      handleError(res, error, 'Error while fetching buy orders');
    }
  }

  @httpGet('/item/:itemId')
  public async getActiveBuyOrdersForItem(req: AuthenticatedRequest, res: Response) {
    const itemId = req.params.itemId;
    try {
      const orders = await this.buyOrderService.getBuyOrders({ itemId, status: 'active' }, 'price DESC, created_at ASC');
      await this.logAction(req, 'getActiveBuyOrdersForItem', 200);
      res.send(orders);
    } catch (error) {
      await this.logAction(req, 'getActiveBuyOrdersForItem', 500, { error });
      handleError(res, error, 'Error while fetching buy orders');
    }
  }
}
