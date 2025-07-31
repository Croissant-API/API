import { Response } from "express";
import { inject } from "inversify";
import {
    controller,
    httpGet,
    httpPost,
    httpPut,
} from "inversify-express-utils";
import { IMarketListingService } from "../services/MarketListingService";
import { ILogService } from "../services/LogService";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { InventoryItem } from "../interfaces/Inventory";

function handleError(res: Response, error: unknown, message: string, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}

@controller("/market-listings")
export class MarketListingController {
    constructor(
        @inject("MarketListingService") private marketListingService: IMarketListingService,
        @inject("LogService") private logService: ILogService
    ) { }

    // Helper pour les logs
    private async logAction(
        req: AuthenticatedRequest,
        tableName?: string,
        statusCode?: number,
        metadata?: object
    ) {
        try {
            const requestBody = { ...req.body };
            if (metadata) {
                requestBody.metadata = metadata;
            }
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] as string || req.socket.remoteAddress as string,
                table_name: tableName,
                controller: 'MarketListingController',
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: req.user?.user_id as string,
                status_code: statusCode
            });
        } catch (error) {
            console.error('Failed to log action:', error);
        }
    }

    @httpPost("/", LoggedCheck.middleware)
    public async createMarketListing(req: AuthenticatedRequest, res: Response) {
        const sellerId = req.user.user_id;
        const { inventoryItem, sellingPrice } = req.body as { inventoryItem: InventoryItem, sellingPrice: number };

        if (!inventoryItem || typeof sellingPrice !== "number") {
            await this.logAction(req, 'market_listings', 400, { reason: 'missing_fields' });
            return res.status(400).send({ message: "inventoryItem and sellingPrice are required" });
        }

        try {
            const listing = await this.marketListingService.createMarketListing(sellerId, inventoryItem, sellingPrice);
            await this.logAction(req, 'market_listings', 201, { listing_id: listing.id });
            res.status(201).send(listing);
        } catch (error) {
            await this.logAction(req, 'market_listings', 500, { error });
            handleError(res, error, "Error while creating the market listing");
        }
    }


    @httpPut("/:id/cancel", LoggedCheck.middleware)
    public async cancelMarketListing(req: AuthenticatedRequest, res: Response) {
        const sellerId = req.user.user_id;
        const listingId = req.params.id;

        try {
            await this.marketListingService.cancelMarketListing(listingId, sellerId);
            await this.logAction(req, 'market_listings', 200, { listing_id: listingId, action: 'cancel' });
            res.status(200).send({ message: "Market listing cancelled" });
        } catch (error) {
            await this.logAction(req, 'market_listings', 500, { listing_id: listingId, error });
            handleError(res, error, "Error while cancelling the market listing");
        }
    }

    @httpGet("/user/:userId", LoggedCheck.middleware)
    public async getMarketListingsByUser(req: AuthenticatedRequest, res: Response) {
        const userId = req.params.userId;
        if (userId !== req.user.user_id) {
            await this.logAction(req, 'market_listings', 403, { reason: 'unauthorized_user_access', requested_user_id: userId });
            return res.status(403).send({ message: "Forbidden" });
        }
        try {
            const listings = await this.marketListingService.getMarketListingsByUser(userId);
            await this.logAction(req, 'market_listings', 200, { user_id: userId, count: listings.length });
            res.send(listings);
        } catch (error) {
            await this.logAction(req, 'market_listings', 500, { user_id: userId, error });
            handleError(res, error, "Error while fetching market listings");
        }
    }

    @httpGet("/item/:itemId")
    public async getActiveListingsForItem(req: AuthenticatedRequest, res: Response) {
        const itemId = req.params.itemId;
        try {
            const listings = await this.marketListingService.getActiveListingsForItem(itemId);
            res.send(listings);
        } catch (error) {
            handleError(res, error, "Error while fetching active market listings");
        }
    }

    @httpGet("/:id")
    public async getMarketListingById(req: AuthenticatedRequest, res: Response) {
        const listingId = req.params.id;
        try {
            const listing = await this.marketListingService.getMarketListingById(listingId);
            if (!listing) {
                return res.status(404).send({ message: "Market listing not found" });
            }
            res.send(listing);
        } catch (error) {
            handleError(res, error, "Error while fetching the market listing");
        }
    }

    @httpGet("/")
    public async getEnrichedMarketListings(req: AuthenticatedRequest, res: Response) {
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        try {
            const listings = await this.marketListingService.getEnrichedMarketListings(limit, offset);
            res.send(listings);
        } catch (error) {
            handleError(res, error, "Error while fetching enriched market listings");
        }
    }

    @httpGet("/search")
    public async searchMarketListings(req: AuthenticatedRequest, res: Response) {
        const searchTerm = req.query.q as string;
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        if (!searchTerm) {
            return res.status(400).send({ message: "Parameter q is required" });
        }
        try {
            const listings = await this.marketListingService.searchMarketListings(searchTerm, limit);
            res.send(listings);
        } catch (error) {
            handleError(res, error, "Error while searching market listings");
        }
    }


    @httpPost("/:id/buy", LoggedCheck.middleware)
    public async buyMarketListing(req: AuthenticatedRequest, res: Response) {
        if(!req.user || !req.user.user_id) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const listingId = req.params.id;
        try {
            const listing = await this.marketListingService.getMarketListingById(listingId);
            if (!listing) {
                return res.status(404).send({ message: "Market listing not found" });
            }
            const result = await this.marketListingService.buyMarketListing(listing.id, req.user.user_id);
            res.send(result);
        } catch (error) {
            handleError(res, error, "Error while buying market listing");
        }
    }
}