import { Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut, httpDelete } from "inversify-express-utils";
import { ITradeService } from '../services/TradeService';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { TradeItem } from '../interfaces/Trade';
import { tradeSchema, tradeStatusSchema, tradeApproveSchema, tradeItemActionSchema } from '../validators/TradeValidator';
import { ValidationError } from 'yup';

@controller("/api/trades")
export class TradeController {
    constructor(
        @inject("TradeService") private tradeService: ITradeService
    ) {}

    @httpPost("/", LoggedCheck.middleware)
    public async createTrade(req: AuthenticatedRequest, res: Response) {
        try {
            const trade = req.body;
            await tradeSchema.validate(trade, { abortEarly: false });
            const createdTrade = await this.tradeService.createTrade(trade);
            res.status(201).send(createdTrade);
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating trade", error: message });
        }
    }

    @httpGet("/:id", LoggedCheck.middleware)
    public async getTradeById(req: AuthenticatedRequest, res: Response) {
        try {
            const id = req.params.id;
            const trade = await this.tradeService.getTradeById(id);
            if (!trade) {
                return res.status(404).send({ message: "Trade not found" });
            }
            res.send(trade);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching trade", error: message });
        }
    }

    @httpGet("/user/:userId", LoggedCheck.middleware)
    public async getTradesByUser(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.params.userId;
            const trades = await this.tradeService.getTradesByUser(userId);
            res.send(trades);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching trades", error: message });
        }
    }

    @httpPut("/:id/status", LoggedCheck.middleware)
    public async updateTradeStatus(req: AuthenticatedRequest, res: Response) {
        try {
            await tradeStatusSchema.validate(req.body, { abortEarly: false });
            const id = req.params.id;
            const { status } = req.body;
            await this.tradeService.updateTradeStatus(id, status);
            res.status(200).send({ message: "Trade status updated" });
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error updating trade status", error: message });
        }
    }

    @httpPut("/:id/approve", LoggedCheck.middleware)
    public async approveTrade(req: AuthenticatedRequest, res: Response) {
        try {
            await tradeApproveSchema.validate(req.body, { abortEarly: false });
            const id = req.params.id;
            const userId = req.user.user_id;
            await this.tradeService.approveTrade(id, userId);
            res.status(200).send({ message: "Trade approved" });
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error approving trade", error: message });
        }
    }

    @httpDelete("/:id", LoggedCheck.middleware)
    public async deleteTrade(req: AuthenticatedRequest, res: Response) {
        try {
            const id = req.params.id;
            await this.tradeService.deleteTrade(id);
            res.status(200).send({ message: "Trade deleted" });
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error deleting trade", error: message });
        }
    }

    @httpPost("/:id/add-item", LoggedCheck.middleware)
    public async addItemToTrade(req: AuthenticatedRequest, res: Response) {
        try {
            await tradeItemActionSchema.validate(req.body, { abortEarly: false });
            const tradeId = req.params.id;
            const { userKey, tradeItem } = req.body as { userKey: "fromUserItems" | "toUserItems", tradeItem: TradeItem };
            await this.tradeService.addItemToTrade(tradeId, userKey, tradeItem);
            res.status(200).send({ message: "Item added to trade" });
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error adding item to trade", error: message });
        }
    }

    @httpPost("/:id/remove-item", LoggedCheck.middleware)
    public async removeItemToTrade(req: AuthenticatedRequest, res: Response) {
        try {
            await tradeItemActionSchema.validate(req.body, { abortEarly: false });
            const tradeId = req.params.id;
            const { userKey, tradeItem } = req.body as { userKey: "fromUserItems" | "toUserItems", tradeItem: TradeItem };
            await this.tradeService.removeItemToTrade(tradeId, userKey, tradeItem);
            res.status(200).send({ message: "Item removed from trade" });
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error removing item from trade", error: message });
        }
    }
}
