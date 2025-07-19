import { Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut } from "inversify-express-utils";
import { ITradeService } from '../services/TradeService';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { TradeItem } from '../interfaces/Trade';
import { tradeItemActionSchema } from '../validators/TradeValidator';
import { ValidationError } from 'yup';

@controller("/trades")
export class Trades {
    constructor(
        @inject("TradeService") private tradeService: ITradeService
    ) {}

    // Commencer ou récupérer la dernière trade pending entre deux users
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
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error starting or getting trade", error: message });
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
            // Sécurité : seuls les users concernés peuvent voir la trade
            if (trade.fromUserId !== req.user.user_id && trade.toUserId !== req.user.user_id) {
                return res.status(403).send({ message: "Forbidden" });
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
            // Sécurité : un user ne peut voir que ses propres trades
            if (userId !== req.user.user_id) {
                return res.status(403).send({ message: "Forbidden" });
            }
            const trades = await this.tradeService.getTradesByUser(userId);
            res.send(trades);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching trades", error: message });
        }
    }

    @httpPost("/:id/add-item", LoggedCheck.middleware)
    public async addItemToTrade(req: AuthenticatedRequest, res: Response) {
        try {
            await tradeItemActionSchema.validate(req.body, { abortEarly: false });
            const tradeId = req.params.id;
            const { tradeItem } = req.body as { tradeItem: TradeItem };
            await this.tradeService.addItemToTrade(tradeId, req.user.user_id, tradeItem);
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
    public async removeItemFromTrade(req: AuthenticatedRequest, res: Response) {
        try {
            await tradeItemActionSchema.validate(req.body, { abortEarly: false });
            const tradeId = req.params.id;
            const { tradeItem } = req.body as { tradeItem: TradeItem };
            await this.tradeService.removeItemFromTrade(tradeId, req.user.user_id, tradeItem);
            res.status(200).send({ message: "Item removed from trade" });
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error removing item from trade", error: message });
        }
    }

    @httpPut("/:id/approve", LoggedCheck.middleware)
    public async approveTrade(req: AuthenticatedRequest, res: Response) {
        try {
            const tradeId = req.params.id;
            await this.tradeService.approveTrade(tradeId, req.user.user_id);
            res.status(200).send({ message: "Trade approved" });
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error approving trade", error: message });
        }
    }

    @httpPut("/:id/cancel", LoggedCheck.middleware)
    public async cancelTrade(req: AuthenticatedRequest, res: Response) {
        try {
            const tradeId = req.params.id;
            await this.tradeService.cancelTrade(tradeId, req.user.user_id);
            res.status(200).send({ message: "Trade canceled" });
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error canceling trade", error: message });
        }
    }
}
