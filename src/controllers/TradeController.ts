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
import { tradeItemActionSchema } from "../validators/TradeValidator";
import { ValidationError } from "yup";
import { Schema } from "yup";

function handleError(res: Response, error: unknown, message: string, status = 500) {
  const msg = error instanceof Error ? error.message : String(error);
  res.status(status).send({ message, error: msg });
}

async function validateOr400(schema: Schema<unknown>, data: unknown, res: Response) {
  try {
    await schema.validate(data, { abortEarly: false });
    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).send({ message: "Validation failed", errors: error.errors });
      return false;
    }
    throw error;
  }
}

@controller("/trades")
export class Trades {
  constructor(@inject("TradeService") private tradeService: ITradeService) {}

  // --- Démarrage ou récupération de trade ---
  @httpPost("/start-or-latest/:userId", LoggedCheck.middleware)
  public async startOrGetPendingTrade(
    req: AuthenticatedRequest,
    res: Response
  ) {
    try {
      const fromUserId = req.user.user_id;
      const toUserId = req.params.userId;
      if (fromUserId === toUserId) {
        return res.status(400).send({ message: "Cannot trade with yourself" });
      }
      const trade = await this.tradeService.startOrGetPendingTrade(
        fromUserId,
        toUserId
      );
      res.status(200).send(trade);
    } catch (error) {
      handleError(res, error, "Error starting or getting trade");
    }
  }

  // --- Lecture ---
  @httpGet("/:id", LoggedCheck.middleware)
  public async getTradeById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id;
      const trade = await this.tradeService.getTradeById(id);
      if (!trade) {
        return res.status(404).send({ message: "Trade not found" });
      }
      if (
        trade.fromUserId !== req.user.user_id &&
        trade.toUserId !== req.user.user_id
      ) {
        return res.status(403).send({ message: "Forbidden" });
      }
      res.send(trade);
    } catch (error) {
      handleError(res, error, "Error fetching trade");
    }
  }

  @httpGet("/user/:userId", LoggedCheck.middleware)
  public async getTradesByUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.params.userId;
      if (userId !== req.user.user_id) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const trades = await this.tradeService.getTradesByUser(userId);
      res.send(trades);
    } catch (error) {
      handleError(res, error, "Error fetching trades");
    }
  }

  // --- Actions sur une trade ---
  @httpPost("/:id/add-item", LoggedCheck.middleware)
  public async addItemToTrade(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(tradeItemActionSchema, req.body, res))) return;
    try {
      const tradeId = req.params.id;
      const { tradeItem } = req.body as { tradeItem: TradeItem };
      await this.tradeService.addItemToTrade(
        tradeId,
        req.user.user_id,
        tradeItem
      );
      res.status(200).send({ message: "Item added to trade" });
    } catch (error) {
      handleError(res, error, "Error adding item to trade");
    }
  }

  @httpPost("/:id/remove-item", LoggedCheck.middleware)
  public async removeItemFromTrade(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(tradeItemActionSchema, req.body, res))) return;
    try {
      const tradeId = req.params.id;
      const { tradeItem } = req.body as { tradeItem: TradeItem };
      await this.tradeService.removeItemFromTrade(
        tradeId,
        req.user.user_id,
        tradeItem
      );
      res.status(200).send({ message: "Item removed from trade" });
    } catch (error) {
      handleError(res, error, "Error removing item from trade");
    }
  }

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
