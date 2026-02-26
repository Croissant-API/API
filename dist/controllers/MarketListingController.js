"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketListingController = void 0;
const inversify_1 = require("inversify");
const hono_inversify_1 = require("../hono-inversify");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
function getPagination(req) {
    return {
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
        search: req.query.q,
    };
}
let MarketListingController = class MarketListingController {
    constructor(marketListingService, logService) {
        this.marketListingService = marketListingService;
        this.logService = logService;
    }
    async createLog(req, action, tableName, statusCode, userId) {
        try {
            await this.logService.createLog({
                ip_address: req.headers['x-real-ip'] || req.socket.remoteAddress,
                table_name: tableName,
                controller: `MarketListingController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: req.body,
                user_id: userId ?? req.user?.user_id,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    async createMarketListing(req, res) {
        const sellerId = req.user.user_id;
        const { inventoryItem, sellingPrice } = req.body;
        if (!inventoryItem || typeof sellingPrice !== 'number') {
            await this.createLog(req, 'createMarketListing', 'market_listings', 400, sellerId);
            return res.status(400).send({ message: 'inventoryItem and sellingPrice are required' });
        }
        try {
            const listing = await this.marketListingService.createMarketListing(sellerId, inventoryItem, sellingPrice);
            await this.createLog(req, 'createMarketListing', 'market_listings', 201, sellerId);
            res.status(201).send(listing);
        }
        catch (error) {
            await this.createLog(req, 'createMarketListing', 'market_listings', 500, sellerId);
            handleError(res, error, 'Error while creating the market listing');
        }
    }
    async cancelMarketListing(req, res) {
        const sellerId = req.user.user_id;
        const listingId = req.params.id;
        try {
            await this.marketListingService.cancelMarketListing(listingId, sellerId);
            await this.createLog(req, 'cancelMarketListing', 'market_listings', 200, sellerId);
            res.status(200).send({ message: 'Market listing cancelled' });
        }
        catch (error) {
            await this.createLog(req, 'cancelMarketListing', 'market_listings', 500, sellerId);
            handleError(res, error, 'Error while cancelling the market listing');
        }
    }
    async getMarketListingsByUser(req, res) {
        const userId = req.params.userId;
        if (userId !== req.user.user_id) {
            await this.createLog(req, 'getMarketListingsByUser', 'market_listings', 403, req.user.user_id);
            return res.status(403).send({ message: 'Forbidden' });
        }
        try {
            const listings = await this.marketListingService.getMarketListingsByUser(userId);
            await this.createLog(req, 'getMarketListingsByUser', 'market_listings', 200, userId);
            res.send(listings);
        }
        catch (error) {
            await this.createLog(req, 'getMarketListingsByUser', 'market_listings', 500, userId);
            handleError(res, error, 'Error while fetching market listings');
        }
    }
    async getActiveListingsForItem(req, res) {
        const itemId = req.params.itemId;
        try {
            const listings = await this.marketListingService.getActiveListingsForItem(itemId);
            await this.createLog(req, 'getActiveListingsForItem', 'market_listings', 200, req.user?.user_id);
            res.send(listings);
        }
        catch (error) {
            await this.createLog(req, 'getActiveListingsForItem', 'market_listings', 500, req.user?.user_id);
            handleError(res, error, 'Error while fetching active market listings');
        }
    }
    async getMarketListingById(req, res) {
        const listingId = req.params.id;
        try {
            const listing = await this.marketListingService.getMarketListingById(listingId);
            if (!listing) {
                await this.createLog(req, 'getMarketListingById', 'market_listings', 404, req.user?.user_id);
                return res.status(404).send({ message: 'Market listing not found' });
            }
            await this.createLog(req, 'getMarketListingById', 'market_listings', 200, req.user?.user_id);
            res.send(listing);
        }
        catch (error) {
            await this.createLog(req, 'getMarketListingById', 'market_listings', 500, req.user?.user_id);
            handleError(res, error, 'Error while fetching the market listing');
        }
    }
    async getEnrichedMarketListings(req, res) {
        const { limit, offset } = getPagination(req);
        try {
            const listings = await this.marketListingService.getEnrichedMarketListings(limit, offset);
            await this.createLog(req, 'getEnrichedMarketListings', 'market_listings', 200, req.user?.user_id);
            res.send(listings);
        }
        catch (error) {
            await this.createLog(req, 'getEnrichedMarketListings', 'market_listings', 500, req.user?.user_id);
            handleError(res, error, 'Error while fetching enriched market listings');
        }
    }
    async searchMarketListings(req, res) {
        const { search, limit } = getPagination(req);
        if (!search) {
            await this.createLog(req, 'searchMarketListings', 'market_listings', 400, req.user?.user_id);
            return res.status(400).send({ message: 'Parameter q is required' });
        }
        try {
            const listings = await this.marketListingService.searchMarketListings(search, limit);
            await this.createLog(req, 'searchMarketListings', 'market_listings', 200, req.user?.user_id);
            res.send(listings);
        }
        catch (error) {
            await this.createLog(req, 'searchMarketListings', 'market_listings', 500, req.user?.user_id);
            handleError(res, error, 'Error while searching market listings');
        }
    }
    async buyMarketListing(req, res) {
        if (!req.user || !req.user.user_id) {
            await this.createLog(req, 'buyMarketListing', 'market_listings', 401, undefined);
            return res.status(401).send({ message: 'Unauthorized' });
        }
        const listingId = req.params.id;
        try {
            const listing = await this.marketListingService.getMarketListingById(listingId);
            if (!listing) {
                await this.createLog(req, 'buyMarketListing', 'market_listings', 404, req.user.user_id);
                return res.status(404).send({ message: 'Market listing not found' });
            }
            const result = await this.marketListingService.buyMarketListing(listing.id, req.user.user_id);
            await this.createLog(req, 'buyMarketListing', 'market_listings', 200, req.user.user_id);
            res.send(result);
        }
        catch (error) {
            await this.createLog(req, 'buyMarketListing', 'market_listings', 500, req.user.user_id);
            handleError(res, error, 'Error while buying market listing');
        }
    }
};
exports.MarketListingController = MarketListingController;
__decorate([
    (0, hono_inversify_1.httpPost)('/', LoggedCheck_1.LoggedCheck.middleware)
], MarketListingController.prototype, "createMarketListing", null);
__decorate([
    (0, hono_inversify_1.httpPut)('/:id/cancel', LoggedCheck_1.LoggedCheck.middleware)
], MarketListingController.prototype, "cancelMarketListing", null);
__decorate([
    (0, hono_inversify_1.httpGet)('/user/:userId', LoggedCheck_1.LoggedCheck.middleware)
], MarketListingController.prototype, "getMarketListingsByUser", null);
__decorate([
    (0, hono_inversify_1.httpGet)('/item/:itemId')
], MarketListingController.prototype, "getActiveListingsForItem", null);
__decorate([
    (0, hono_inversify_1.httpGet)('/:id')
], MarketListingController.prototype, "getMarketListingById", null);
__decorate([
    (0, hono_inversify_1.httpGet)('/')
], MarketListingController.prototype, "getEnrichedMarketListings", null);
__decorate([
    (0, hono_inversify_1.httpGet)('/search')
], MarketListingController.prototype, "searchMarketListings", null);
__decorate([
    (0, hono_inversify_1.httpPost)('/:id/buy', LoggedCheck_1.LoggedCheck.middleware)
], MarketListingController.prototype, "buyMarketListing", null);
exports.MarketListingController = MarketListingController = __decorate([
    (0, hono_inversify_1.controller)('/market-listings'),
    __param(0, (0, inversify_1.inject)('MarketListingService')),
    __param(1, (0, inversify_1.inject)('LogService'))
], MarketListingController);
