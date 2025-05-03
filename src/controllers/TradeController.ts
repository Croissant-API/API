import { Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut, httpDelete } from "inversify-express-utils";
import { ITradeService } from '../services/TradeService';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { TradeItem } from '../interfaces/Trade';
import { tradeSchema, tradeStatusSchema, tradeApproveSchema, tradeItemActionSchema } from '../validators/TradeValidator';
import { ValidationError } from 'yup';
import { describe } from '../decorators/describe';

@controller("/trades")
export class TradeController {
    constructor(
        @inject("TradeService") private tradeService: ITradeService
    ) {}

    @describe({
        endpoint: "/trades",
        method: "POST",
        description: "Create a new trade",
        body: {
            fromUserId: "ID of the user initiating the trade",
            toUserId: "ID of the user receiving the trade",
            fromUserItems: "Array of items from the sender",
            toUserItems: "Array of items from the receiver"
        },
        responseType: "object{tradeId: string, ...}",
        example: "POST /api/trades {\"fromUserId\": \"user1\", \"toUserId\": \"user2\", \"fromUserItems\": [...], \"toUserItems\": [...]}"
    })
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

    @describe({
        endpoint: "/trades/:id",
        method: "GET",
        description: "Get a trade by ID",
        params: { id: "The id of the trade" },
        responseType: "object{tradeId: string, ...}",
        example: "GET /api/trades/123"
    })
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

    @describe({
        endpoint: "/trades/user/:userId",
        method: "GET",
        description: "Get all trades for a user",
        params: { userId: "The id of the user" },
        responseType: "array[object{tradeId: string, ...}]",
        example: "GET /api/trades/user/123"
    })
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

    @describe({
        endpoint: "/trades/:id/status",
        method: "PUT",
        description: "Update the status of a trade",
        params: { id: "The id of the trade" },
        body: { status: "The new status of the trade" },
        responseType: "object{message: string}",
        example: "PUT /api/trades/123/status {\"status\": \"accepted\"}"
    })
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

    @describe({
        endpoint: "/trades/:id/approve",
        method: "PUT",
        description: "Approve a trade",
        params: { id: "The id of the trade" },
        body: { userId: "The id of the user approving the trade" },
        responseType: "object{message: string}",
        example: "PUT /api/trades/123/approve {\"userId\": \"user1\"}"
    })
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

    @describe({
        endpoint: "/trades/:id",
        method: "DELETE",
        description: "Delete a trade",
        params: { id: "The id of the trade" },
        responseType: "object{message: string}",
        example: "DELETE /api/trades/123"
    })
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

    @describe({
        endpoint: "/trades/:id/add-item",
        method: "POST",
        description: "Add an item to a trade",
        params: { id: "The id of the trade" },
        body: {
            userKey: "\"fromUserItems\" or \"toUserItems\"",
            tradeItem: "The item to add"
        },
        responseType: "object{message: string}",
        example: "POST /api/trades/123/add-item {\"userKey\": \"fromUserItems\", \"tradeItem\": {...}}"
    })
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

    @describe({
        endpoint: "/trades/:id/remove-item",
        method: "POST",
        description: "Remove an item from a trade",
        params: { id: "The id of the trade" },
        body: {
            userKey: "\"fromUserItems\" or \"toUserItems\"",
            tradeItem: "The item to remove"
        },
        responseType: "object{message: string}",
        example: "POST /api/trades/123/remove-item {\"userKey\": \"fromUserItems\", \"tradeItem\": {...}}"
    })
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
