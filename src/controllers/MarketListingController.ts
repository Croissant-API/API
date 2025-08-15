import { Response } from "express";
import { inject } from "inversify";
import { controller, httpGet, httpPost, httpPut } from "inversify-express-utils";
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
 ) {}

 // Helper pour les logs (uniformisé)
 private async createLog(req: AuthenticatedRequest, action: string, tableName?: string, statusCode?: number, userId?: string) {
  try {
   await this.logService.createLog({
    ip_address: (req.headers["x-real-ip"] as string) || (req.socket.remoteAddress as string),
    table_name: tableName,
    controller: `MarketListingController.${action}`,
    original_path: req.originalUrl,
    http_method: req.method,
    request_body: req.body,
    user_id: userId ?? req.user?.user_id,
    status_code: statusCode,
   });
  } catch (error) {
   console.error("Failed to log action:", error);
  }
 }

 @httpPost("/", LoggedCheck.middleware)
 public async createMarketListing(req: AuthenticatedRequest, res: Response) {
  const sellerId = req.user.user_id;
  const { inventoryItem, sellingPrice } = req.body as { inventoryItem: InventoryItem; sellingPrice: number };

  if (!inventoryItem || typeof sellingPrice !== "number") {
   await this.createLog(req, "createMarketListing", "market_listings", 400, sellerId);
   return res.status(400).send({ message: "inventoryItem and sellingPrice are required" });
  }

  try {
   const listing = await this.marketListingService.createMarketListing(sellerId, inventoryItem, sellingPrice);
   await this.createLog(req, "createMarketListing", "market_listings", 201, sellerId);
   res.status(201).send(listing);
  } catch (error) {
   await this.createLog(req, "createMarketListing", "market_listings", 500, sellerId);
   handleError(res, error, "Error while creating the market listing");
  }
 }

 @httpPut("/:id/cancel", LoggedCheck.middleware)
 public async cancelMarketListing(req: AuthenticatedRequest, res: Response) {
  const sellerId = req.user.user_id;
  const listingId = req.params.id;

  try {
   await this.marketListingService.cancelMarketListing(listingId, sellerId);
   await this.createLog(req, "cancelMarketListing", "market_listings", 200, sellerId);
   res.status(200).send({ message: "Market listing cancelled" });
  } catch (error) {
   await this.createLog(req, "cancelMarketListing", "market_listings", 500, sellerId);
   handleError(res, error, "Error while cancelling the market listing");
  }
 }

 @httpGet("/user/:userId", LoggedCheck.middleware)
 public async getMarketListingsByUser(req: AuthenticatedRequest, res: Response) {
  const userId = req.params.userId;
  if (userId !== req.user.user_id) {
   await this.createLog(req, "getMarketListingsByUser", "market_listings", 403, req.user.user_id);
   return res.status(403).send({ message: "Forbidden" });
  }
  try {
   const listings = await this.marketListingService.getMarketListingsByUser(userId);
   await this.createLog(req, "getMarketListingsByUser", "market_listings", 200, userId);
   res.send(listings);
  } catch (error) {
   await this.createLog(req, "getMarketListingsByUser", "market_listings", 500, userId);
   handleError(res, error, "Error while fetching market listings");
  }
 }

 @httpGet("/item/:itemId")
 public async getActiveListingsForItem(req: AuthenticatedRequest, res: Response) {
  const itemId = req.params.itemId;
  try {
   const listings = await this.marketListingService.getActiveListingsForItem(itemId);
   await this.createLog(req, "getActiveListingsForItem", "market_listings", 200, req.user?.user_id);
   res.send(listings);
  } catch (error) {
   await this.createLog(req, "getActiveListingsForItem", "market_listings", 500, req.user?.user_id);
   handleError(res, error, "Error while fetching active market listings");
  }
 }

 @httpGet("/:id")
 public async getMarketListingById(req: AuthenticatedRequest, res: Response) {
  const listingId = req.params.id;
  try {
   const listing = await this.marketListingService.getMarketListingById(listingId);
   if (!listing) {
    await this.createLog(req, "getMarketListingById", "market_listings", 404, req.user?.user_id);
    return res.status(404).send({ message: "Market listing not found" });
   }
   await this.createLog(req, "getMarketListingById", "market_listings", 200, req.user?.user_id);
   res.send(listing);
  } catch (error) {
   await this.createLog(req, "getMarketListingById", "market_listings", 500, req.user?.user_id);
   handleError(res, error, "Error while fetching the market listing");
  }
 }

 @httpGet("/")
 public async getEnrichedMarketListings(req: AuthenticatedRequest, res: Response) {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  try {
   const listings = await this.marketListingService.getEnrichedMarketListings(limit, offset);
   await this.createLog(req, "getEnrichedMarketListings", "market_listings", 200, req.user?.user_id);
   res.send(listings);
  } catch (error) {
   await this.createLog(req, "getEnrichedMarketListings", "market_listings", 500, req.user?.user_id);
   handleError(res, error, "Error while fetching enriched market listings");
  }
 }

 @httpGet("/search")
 public async searchMarketListings(req: AuthenticatedRequest, res: Response) {
  const searchTerm = req.query.q as string;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  if (!searchTerm) {
   await this.createLog(req, "searchMarketListings", "market_listings", 400, req.user?.user_id);
   return res.status(400).send({ message: "Parameter q is required" });
  }
  try {
   const listings = await this.marketListingService.searchMarketListings(searchTerm, limit);
   await this.createLog(req, "searchMarketListings", "market_listings", 200, req.user?.user_id);
   res.send(listings);
  } catch (error) {
   await this.createLog(req, "searchMarketListings", "market_listings", 500, req.user?.user_id);
   handleError(res, error, "Error while searching market listings");
  }
 }

 @httpPost("/:id/buy", LoggedCheck.middleware)
 public async buyMarketListing(req: AuthenticatedRequest, res: Response) {
  if (!req.user || !req.user.user_id) {
   await this.createLog(req, "buyMarketListing", "market_listings", 401, undefined);
   return res.status(401).send({ message: "Unauthorized" });
  }
  const listingId = req.params.id;
  try {
   const listing = await this.marketListingService.getMarketListingById(listingId);
   if (!listing) {
    await this.createLog(req, "buyMarketListing", "market_listings", 404, req.user.user_id);
    return res.status(404).send({ message: "Market listing not found" });
   }
   const result = await this.marketListingService.buyMarketListing(listing.id, req.user.user_id);
   await this.createLog(req, "buyMarketListing", "market_listings", 200, req.user.user_id);
   res.send(result);
  } catch (error) {
   await this.createLog(req, "buyMarketListing", "market_listings", 500, req.user.user_id);
   handleError(res, error, "Error while buying market listing");
  }
 }
}
