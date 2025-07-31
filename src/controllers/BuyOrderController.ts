import { Response } from "express";
import { inject } from "inversify";
import { controller, httpGet, httpPost, httpPut } from "inversify-express-utils";
import { IBuyOrderService } from "../services/BuyOrderService";
import { IItemService } from "../services/ItemService";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";

@controller("/buy-orders")
export class BuyOrderController {
    constructor(
        @inject("BuyOrderService") private buyOrderService: IBuyOrderService,
        @inject("ItemService") private itemService: IItemService
    ) {}

    @httpPost("/", LoggedCheck.middleware)
    public async createBuyOrder(req: AuthenticatedRequest, res: Response) {
        const buyerId = req.user.user_id;
        const { itemId, price } = req.body;
        if (!itemId || typeof price !== "number" || price < 1) {
            return res.status(400).send({ message: "itemId and price are required" });
        }

        // S'assurer que l'item existe
        const itemExists = await this.itemService.getItem(itemId);

        if (!itemExists) {
            return res.status(404).send({ message: "Item not found" });
        }

        try {
            const order = await this.buyOrderService.createBuyOrder(buyerId, itemId, price);
            res.status(201).send(order);
        } catch (error) {
            res.status(500).send({ message: "Error while creating buy order", error: String(error) });
        }
    }

    @httpPut("/:id/cancel", LoggedCheck.middleware)
    public async cancelBuyOrder(req: AuthenticatedRequest, res: Response) {
        const buyerId = req.user.user_id;
        const orderId = req.params.id;
        try {
            await this.buyOrderService.cancelBuyOrder(orderId, buyerId);
            res.status(200).send({ message: "Buy order cancelled" });
        } catch (error) {
            res.status(500).send({ message: "Error while cancelling buy order", error: String(error) });
        }
    }

    @httpGet("/user/:userId", LoggedCheck.middleware)
    public async getBuyOrdersByUser(req: AuthenticatedRequest, res: Response) {
        const userId = req.params.userId;
        if (userId !== req.user.user_id) {
            return res.status(403).send({ message: "Forbidden" });
        }
        try {
            const orders = await this.buyOrderService.getBuyOrdersByUser(userId);
            res.send(orders);
        } catch (error) {
            res.status(500).send({ message: "Error while fetching buy orders", error: String(error) });
        }
    }

    @httpGet("/item/:itemId")
    public async getActiveBuyOrdersForItem(req: AuthenticatedRequest, res: Response) {
        const itemId = req.params.itemId;
        try {
            const orders = await this.buyOrderService.getActiveBuyOrdersForItem(itemId);
            res.send(orders);
        } catch (error) {
            res.status(500).send({ message: "Error while fetching buy orders", error: String(error) });
        }
    }
}