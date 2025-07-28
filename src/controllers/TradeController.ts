import { Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  httpPost,
  httpPut,
} from "inversify-express-utils";
import { ITradeService } from "../services/TradeService";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { TradeItem } from "../interfaces/Trade";
import { describe } from "../decorators/describe";

function handleError(res: Response, error: unknown, message: string, status = 500) {
  const msg = error instanceof Error ? error.message : String(error);
  res.status(status).send({ message, error: msg });
}

@controller("/trades")
export class Trades {
  constructor(@inject("TradeService") private tradeService: ITradeService) {}

  // --- Démarrage ou récupération de trade ---
  @describe({
    endpoint: "/trades/start-or-latest/:userId",
    method: "POST",
    description: "Start a new trade or get the latest pending trade with a user",
    params: { userId: "The ID of the user to trade with" },
    responseType: {
      id: "string",
      fromUserId: "string",
      toUserId: "string",
      fromUserItems: ["object"],
      toUserItems: ["object"],
      approvedFromUser: "boolean",
      approvedToUser: "boolean",
      status: "string",
      createdAt: "string",
      updatedAt: "string"
    },
    example: "POST /api/trades/start-or-latest/user123",
    requiresAuth: true
  })
  @httpPost("/start-or-latest/:userId", LoggedCheck.middleware)
  public async startOrGetPendingTrade(req: AuthenticatedRequest, res: Response) {
    try {
      const fromUserId = req.user.user_id;
      const toUserId = req.params.userId;
      
      if (fromUserId === toUserId) {
        return res.status(400).send({ message: "Cannot trade with yourself" });
      }
      
      const trade = await this.tradeService.startOrGetPendingTrade(fromUserId, toUserId);
      res.status(200).send(trade);
    } catch (error) {
      handleError(res, error, "Error starting or getting trade");
    }
  }

  // --- Lecture ---
  @describe({
    endpoint: "/trades/:id",
    method: "GET",
    description: "Get a trade by ID with enriched item information",
    params: { id: "The ID of the trade" },
    responseType: {
      id: "string",
      fromUserId: "string",
      toUserId: "string",
      fromUserItems: [{
        itemId: "string",
        name: "string",
        description: "string",
        iconHash: "string",
        amount: "number"
      }],
      toUserItems: [{
        itemId: "string",
        name: "string",
        description: "string",
        iconHash: "string",
        amount: "number"
      }],
      approvedFromUser: "boolean",
      approvedToUser: "boolean",
      status: "string",
      createdAt: "string",
      updatedAt: "string"
    },
    example: "GET /api/trades/trade123",
    requiresAuth: true
  })
  @httpGet("/:id", LoggedCheck.middleware)
  public async getTradeById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id;
      const trade = await this.tradeService.getFormattedTradeById(id);
      
      if (!trade) {
        return res.status(404).send({ message: "Trade not found" });
      }
      
      if (trade.fromUserId !== req.user.user_id && trade.toUserId !== req.user.user_id) {
        return res.status(403).send({ message: "Forbidden" });
      }
      
      res.send(trade);
    } catch (error) {
      handleError(res, error, "Error fetching trade");
    }
  }

  @describe({
    endpoint: "/trades/user/:userId",
    method: "GET",
    description: "Get all trades for a user with enriched item information",
    params: { userId: "The ID of the user" },
    responseType: [{
      id: "string",
      fromUserId: "string",
      toUserId: "string",
      fromUserItems: [{
        itemId: "string",
        name: "string",
        description: "string",
        iconHash: "string",
        amount: "number"
      }],
      toUserItems: [{
        itemId: "string",
        name: "string",
        description: "string",
        iconHash: "string",
        amount: "number"
      }],
      approvedFromUser: "boolean",
      approvedToUser: "boolean",
      status: "string",
      createdAt: "string",
      updatedAt: "string"
    }],
    example: "GET /api/trades/user/user123",
    requiresAuth: true
  })
  @httpGet("/user/:userId", LoggedCheck.middleware)
  public async getTradesByUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.params.userId;
      
      if (userId !== req.user.user_id) {
        return res.status(403).send({ message: "Forbidden" });
      }
      
      const trades = await this.tradeService.getFormattedTradesByUser(userId);
      res.send(trades);
    } catch (error) {
      handleError(res, error, "Error fetching trades");
    }
  }

  // --- Actions sur une trade ---
  @describe({
    endpoint: "/trades/:id/add-item",
    method: "POST",
    description: "Add an item to a trade",
    params: { id: "The ID of the trade" },
    body: {
      tradeItem: {
        itemId: "The ID of the item to add",
        amount: "The amount of the item to add",
        metadata: "Metadata object including _unique_id for unique items (optional)"
      }
    },
    responseType: { message: "string" },
    example: 'POST /api/trades/trade123/add-item {"tradeItem": {"itemId": "item456", "amount": 5}} or {"tradeItem": {"itemId": "item456", "amount": 1, "metadata": {"level": 5, "_unique_id": "abc-123"}}}',
    requiresAuth: true
  })
  @httpPost("/:id/add-item", LoggedCheck.middleware)
  public async addItemToTrade(req: AuthenticatedRequest, res: Response) {
    try {
      const tradeId = req.params.id;
      const { tradeItem } = req.body as { tradeItem: TradeItem };
      
      if (!tradeItem.itemId || !tradeItem.amount || tradeItem.amount <= 0) {
        return res.status(400).send({ message: "Invalid tradeItem format" });
      }
      
      await this.tradeService.addItemToTrade(tradeId, req.user.user_id, tradeItem);
      res.status(200).send({ message: "Item added to trade" });
    } catch (error) {
      handleError(res, error, "Error adding item to trade");
    }
  }

  @describe({
    endpoint: "/trades/:id/remove-item",
    method: "POST",
    description: "Remove an item from a trade",
    params: { id: "The ID of the trade" },
    body: {
      tradeItem: {
        itemId: "The ID of the item to remove",
        amount: "The amount of the item to remove",
        metadata: "Metadata object including _unique_id for unique items (optional)"
      }
    },
    responseType: { message: "string" },
    example: 'POST /api/trades/trade123/remove-item {"tradeItem": {"itemId": "item456", "amount": 2}} or {"tradeItem": {"itemId": "item456", "metadata": {"_unique_id": "abc-123"}}}',
    requiresAuth: true
  })
  @httpPost("/:id/remove-item", LoggedCheck.middleware)
  public async removeItemFromTrade(req: AuthenticatedRequest, res: Response) {
    try {
      const tradeId = req.params.id;
      const { tradeItem } = req.body as { tradeItem: TradeItem };
      
      if (!tradeItem.itemId) {
        return res.status(400).send({ message: "Invalid tradeItem format" });
      }
      
      // Pour les items avec _unique_id, l'amount peut être omis
      if (!tradeItem.metadata?._unique_id && (!tradeItem.amount || tradeItem.amount <= 0)) {
        return res.status(400).send({ message: "Amount is required for items without _unique_id" });
      }
      
      await this.tradeService.removeItemFromTrade(tradeId, req.user.user_id, tradeItem);
      res.status(200).send({ message: "Item removed from trade" });
    } catch (error) {
      handleError(res, error, "Error removing item from trade");
    }
  }

  @describe({
    endpoint: "/trades/:id/approve",
    method: "PUT",
    description: "Approve a trade",
    params: { id: "The ID of the trade" },
    responseType: { message: "string" },
    example: "PUT /api/trades/trade123/approve",
    requiresAuth: true
  })
  @httpPut("/:id/approve", LoggedCheck.middleware)
  public async approveTrade(req: AuthenticatedRequest, res: Response) {
    try {
      const tradeId = req.params.id;
      await this.tradeService.approveTrade(tradeId, req.user.user_id);
      res.status(200).send({ message: "Trade approved" });
    } catch (error) {
      handleError(res, error, "Error approving trade");
    }
  }

  @describe({
    endpoint: "/trades/:id/cancel",
    method: "PUT",
    description: "Cancel a trade",
    params: { id: "The ID of the trade" },
    responseType: { message: "string" },
    example: "PUT /api/trades/trade123/cancel",
    requiresAuth: true
  })
  @httpPut("/:id/cancel", LoggedCheck.middleware)
  public async cancelTrade(req: AuthenticatedRequest, res: Response) {
    try {
      const tradeId = req.params.id;
      await this.tradeService.cancelTrade(tradeId, req.user.user_id);
      res.status(200).send({ message: "Trade canceled" });
    } catch (error) {
      handleError(res, error, "Error canceling trade");
    }
  }
}
