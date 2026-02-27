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
import { inject, injectable } from 'inversify';
import { LoggedCheck } from 'middlewares/LoggedCheck';
import { controller, httpGet, httpPost, httpPut } from '../hono-inversify';
let MarketListingController = class MarketListingController {
    constructor(marketListingService, logService) {
        this.marketListingService = marketListingService;
        this.logService = logService;
    }
    sendError(c, status, message) {
        return c.json({ message }, status);
    }
    async createLog(c, action, tableName, statusCode, userId, body) {
        try {
            const clientIP = c.req.header('cf-connecting-ip') ||
                c.req.header('x-forwarded-for') ||
                c.req.header('x-real-ip') ||
                'unknown';
            await this.logService.createLog({
                ip_address: clientIP,
                table_name: tableName,
                controller: `MarketListingController.${action}`,
                original_path: c.req.path,
                http_method: c.req.method,
                request_body: JSON.stringify(body || {}),
                user_id: userId,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    getUserFromContext(c) {
        return c.get('user');
    }
    async createMarketListing(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const body = await c.req.json();
        const { inventoryItem, sellingPrice } = body;
        if (!inventoryItem || typeof sellingPrice !== 'number') {
            await this.createLog(c, 'createMarketListing', 'market_listings', 400, user.user_id, body);
            return this.sendError(c, 400, 'inventoryItem and sellingPrice are required');
        }
        try {
            const listing = await this.marketListingService.createMarketListing(user.user_id, inventoryItem, sellingPrice);
            await this.createLog(c, 'createMarketListing', 'market_listings', 201, user.user_id, body);
            return c.json(listing, 201);
        }
        catch (error) {
            await this.createLog(c, 'createMarketListing', 'market_listings', 500, user.user_id, body);
            return this.sendError(c, 500, 'Error while creating the market listing');
        }
    }
    async cancelMarketListing(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const listingId = c.req.param('id');
        try {
            await this.marketListingService.cancelMarketListing(listingId, user.user_id);
            await this.createLog(c, 'cancelMarketListing', 'market_listings', 200, user.user_id);
            return c.json({ message: 'Market listing cancelled' });
        }
        catch (error) {
            await this.createLog(c, 'cancelMarketListing', 'market_listings', 500, user.user_id);
            return this.sendError(c, 500, 'Error while cancelling the market listing');
        }
    }
    async getMarketListingsByUser(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const userId = c.req.param('userId');
        if (userId !== user.user_id) {
            await this.createLog(c, 'getMarketListingsByUser', 'market_listings', 403, user.user_id);
            return this.sendError(c, 403, 'Forbidden');
        }
        try {
            const listings = await this.marketListingService.getMarketListingsByUser(userId);
            await this.createLog(c, 'getMarketListingsByUser', 'market_listings', 200, userId);
            return c.json(listings);
        }
        catch (error) {
            await this.createLog(c, 'getMarketListingsByUser', 'market_listings', 500, userId);
            return this.sendError(c, 500, 'Error while fetching market listings');
        }
    }
    async getActiveListingsForItem(c) {
        const itemId = c.req.param('itemId');
        try {
            const listings = await this.marketListingService.getActiveListingsForItem(itemId);
            await this.createLog(c, 'getActiveListingsForItem', 'market_listings', 200, undefined);
            return c.json(listings);
        }
        catch (error) {
            await this.createLog(c, 'getActiveListingsForItem', 'market_listings', 500, undefined);
            return this.sendError(c, 500, 'Error while fetching active market listings');
        }
    }
    async getMarketListingById(c) {
        const listingId = c.req.param('id');
        try {
            const listing = await this.marketListingService.getMarketListingById(listingId);
            if (!listing) {
                await this.createLog(c, 'getMarketListingById', 'market_listings', 404, undefined);
                return this.sendError(c, 404, 'Market listing not found');
            }
            await this.createLog(c, 'getMarketListingById', 'market_listings', 200, undefined);
            return c.json(listing);
        }
        catch (error) {
            await this.createLog(c, 'getMarketListingById', 'market_listings', 500, undefined);
            return this.sendError(c, 500, 'Error while fetching the market listing');
        }
    }
    async getEnrichedMarketListings(c) {
        const limit = c.req.query('limit');
        const offset = c.req.query('offset');
        try {
            const listings = await this.marketListingService.getEnrichedMarketListings(Number(limit) || 50, Number(offset) || 0);
            await this.createLog(c, 'getEnrichedMarketListings', 'market_listings', 200, undefined);
            return c.json(listings);
        }
        catch (error) {
            await this.createLog(c, 'getEnrichedMarketListings', 'market_listings', 500, undefined);
            return this.sendError(c, 500, 'Error while fetching enriched market listings');
        }
    }
    async searchMarketListings(c) {
        const q = c.req.query('q');
        const limit = c.req.query('limit');
        if (!q) {
            await this.createLog(c, 'searchMarketListings', 'market_listings', 400, undefined);
            return this.sendError(c, 400, 'Parameter q is required');
        }
        try {
            const listings = await this.marketListingService.searchMarketListings(String(q), Number(limit) || 50);
            await this.createLog(c, 'searchMarketListings', 'market_listings', 200, undefined);
            return c.json(listings);
        }
        catch (error) {
            await this.createLog(c, 'searchMarketListings', 'market_listings', 500, undefined);
            return this.sendError(c, 500, 'Error while searching market listings');
        }
    }
    async buyMarketListing(c) {
        const user = this.getUserFromContext(c);
        if (!user)
            return this.sendError(c, 401, 'Unauthorized');
        const listingId = c.req.param('id');
        try {
            const listing = await this.marketListingService.getMarketListingById(listingId);
            if (!listing) {
                await this.createLog(c, 'buyMarketListing', 'market_listings', 404, user.user_id);
                return this.sendError(c, 404, 'Market listing not found');
            }
            const result = await this.marketListingService.buyMarketListing(listing.id, user.user_id);
            await this.createLog(c, 'buyMarketListing', 'market_listings', 200, user.user_id);
            return c.json(result);
        }
        catch (error) {
            await this.createLog(c, 'buyMarketListing', 'market_listings', 500, user.user_id);
            return this.sendError(c, 500, 'Error while buying market listing');
        }
    }
};
__decorate([
    httpPost('/', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "createMarketListing", null);
__decorate([
    httpPut('/:id/cancel', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "cancelMarketListing", null);
__decorate([
    httpGet('/user/:userId', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "getMarketListingsByUser", null);
__decorate([
    httpGet('/item/:itemId'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "getActiveListingsForItem", null);
__decorate([
    httpGet('/:id'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "getMarketListingById", null);
__decorate([
    httpGet('/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "getEnrichedMarketListings", null);
__decorate([
    httpGet('/search'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "searchMarketListings", null);
__decorate([
    httpPost('/:id/buy', LoggedCheck),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], MarketListingController.prototype, "buyMarketListing", null);
MarketListingController = __decorate([
    injectable(),
    controller('/market-listings'),
    __param(0, inject('MarketListingService')),
    __param(1, inject('LogService')),
    __metadata("design:paramtypes", [Object, Object])
], MarketListingController);
export { MarketListingController };
