"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketListingController = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
let MarketListingController = class MarketListingController {
    constructor(marketListingService, logService) {
        this.marketListingService = marketListingService;
        this.logService = logService;
    }
    // Helper pour les logs
    async logAction(req, tableName, statusCode, metadata) {
        try {
            const requestBody = { ...req.body };
            if (metadata) {
                requestBody.metadata = metadata;
            }
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] || req.socket.remoteAddress,
                table_name: tableName,
                controller: 'MarketListingController',
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: req.user?.user_id,
                status_code: statusCode
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    async createMarketListing(req, res) {
        const sellerId = req.user.user_id;
        const { inventoryItem, sellingPrice } = req.body;
        if (!inventoryItem || typeof sellingPrice !== "number") {
            await this.logAction(req, 'market_listings', 400, { reason: 'missing_fields' });
            return res.status(400).send({ message: "inventoryItem and sellingPrice are required" });
        }
        try {
            const listing = await this.marketListingService.createMarketListing(sellerId, inventoryItem, sellingPrice);
            await this.logAction(req, 'market_listings', 201, { listing_id: listing.id });
            res.status(201).send(listing);
        }
        catch (error) {
            await this.logAction(req, 'market_listings', 500, { error });
            handleError(res, error, "Error while creating the market listing");
        }
    }
    async cancelMarketListing(req, res) {
        const sellerId = req.user.user_id;
        const listingId = req.params.id;
        try {
            await this.marketListingService.cancelMarketListing(listingId, sellerId);
            await this.logAction(req, 'market_listings', 200, { listing_id: listingId, action: 'cancel' });
            res.status(200).send({ message: "Market listing cancelled" });
        }
        catch (error) {
            await this.logAction(req, 'market_listings', 500, { listing_id: listingId, error });
            handleError(res, error, "Error while cancelling the market listing");
        }
    }
    async getMarketListingsByUser(req, res) {
        const userId = req.params.userId;
        if (userId !== req.user.user_id) {
            await this.logAction(req, 'market_listings', 403, { reason: 'unauthorized_user_access', requested_user_id: userId });
            return res.status(403).send({ message: "Forbidden" });
        }
        try {
            const listings = await this.marketListingService.getMarketListingsByUser(userId);
            await this.logAction(req, 'market_listings', 200, { user_id: userId, count: listings.length });
            res.send(listings);
        }
        catch (error) {
            await this.logAction(req, 'market_listings', 500, { user_id: userId, error });
            handleError(res, error, "Error while fetching market listings");
        }
    }
    async getActiveListingsForItem(req, res) {
        const itemId = req.params.itemId;
        try {
            const listings = await this.marketListingService.getActiveListingsForItem(itemId);
            res.send(listings);
        }
        catch (error) {
            handleError(res, error, "Error while fetching active market listings");
        }
    }
    async getMarketListingById(req, res) {
        const listingId = req.params.id;
        try {
            const listing = await this.marketListingService.getMarketListingById(listingId);
            if (!listing) {
                return res.status(404).send({ message: "Market listing not found" });
            }
            res.send(listing);
        }
        catch (error) {
            handleError(res, error, "Error while fetching the market listing");
        }
    }
    async getEnrichedMarketListings(req, res) {
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        try {
            const listings = await this.marketListingService.getEnrichedMarketListings(limit, offset);
            res.send(listings);
        }
        catch (error) {
            handleError(res, error, "Error while fetching enriched market listings");
        }
    }
    async searchMarketListings(req, res) {
        const searchTerm = req.query.q;
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        if (!searchTerm) {
            return res.status(400).send({ message: "Parameter q is required" });
        }
        try {
            const listings = await this.marketListingService.searchMarketListings(searchTerm, limit);
            res.send(listings);
        }
        catch (error) {
            handleError(res, error, "Error while searching market listings");
        }
    }
    async buyMarketListing(req, res) {
        if (!req.user || !req.user.user_id) {
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
        }
        catch (error) {
            handleError(res, error, "Error while buying market listing");
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpPost)("/", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "createMarketListing", null);
__decorate([
    (0, inversify_express_utils_1.httpPut)("/:id/cancel", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "cancelMarketListing", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/user/:userId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "getMarketListingsByUser", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/item/:itemId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "getActiveListingsForItem", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/:id"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "getMarketListingById", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "getEnrichedMarketListings", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/search"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "searchMarketListings", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/:id/buy", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "buyMarketListing", null);
MarketListingController = __decorate([
    (0, inversify_express_utils_1.controller)("/market-listings"),
    __param(0, (0, inversify_1.inject)("MarketListingService")),
    __param(1, (0, inversify_1.inject)("LogService")),
    __metadata("design:paramtypes", [Object, Object])
], MarketListingController);
exports.MarketListingController = MarketListingController;
