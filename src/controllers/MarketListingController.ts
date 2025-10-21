/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Context } from 'hono';
import { inject, injectable } from 'inversify';
import { LoggedCheck } from 'middlewares/LoggedCheck';
import { controller, httpGet, httpPost, httpPut } from '../hono-inversify';
import { ILogService } from '../services/LogService';
import { IMarketListingService } from '../services/MarketListingService';

@injectable()
@controller('/market-listings')
export class MarketListingController {
  constructor(
    @inject('MarketListingService') private marketListingService: IMarketListingService,
    @inject('LogService') private logService: ILogService
  ) {}

  private sendError(c: Context, status: number, message: string) {
    return c.json({ message }, status as any);
  }

  private async createLog(c: Context, action: string, tableName?: string, statusCode?: number, userId?: string, body?: any) {
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
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  private getUserFromContext(c: Context) {
    return c.get('user');
  }

  @httpPost('/', LoggedCheck)
  public async createMarketListing(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
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
    } catch (error) {
      await this.createLog(c, 'createMarketListing', 'market_listings', 500, user.user_id, body);
      return this.sendError(c, 500, 'Error while creating the market listing');
    }
  }

  @httpPut('/:id/cancel', LoggedCheck)
  public async cancelMarketListing(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const listingId = c.req.param('id');
    try {
      await this.marketListingService.cancelMarketListing(listingId, user.user_id);
      await this.createLog(c, 'cancelMarketListing', 'market_listings', 200, user.user_id);
      return c.json({ message: 'Market listing cancelled' });
    } catch (error) {
      await this.createLog(c, 'cancelMarketListing', 'market_listings', 500, user.user_id);
      return this.sendError(c, 500, 'Error while cancelling the market listing');
    }
  }

  @httpGet('/user/:userId', LoggedCheck)
  public async getMarketListingsByUser(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const userId = c.req.param('userId');
    if (userId !== user.user_id) {
      await this.createLog(c, 'getMarketListingsByUser', 'market_listings', 403, user.user_id);
      return this.sendError(c, 403, 'Forbidden');
    }
    try {
      const listings = await this.marketListingService.getMarketListingsByUser(userId);
      await this.createLog(c, 'getMarketListingsByUser', 'market_listings', 200, userId);
      return c.json(listings);
    } catch (error) {
      await this.createLog(c, 'getMarketListingsByUser', 'market_listings', 500, userId);
      return this.sendError(c, 500, 'Error while fetching market listings');
    }
  }

  @httpGet('/item/:itemId')
  public async getActiveListingsForItem(c: Context) {
    const itemId = c.req.param('itemId');
    try {
      const listings = await this.marketListingService.getActiveListingsForItem(itemId);
      await this.createLog(c, 'getActiveListingsForItem', 'market_listings', 200, undefined);
      return c.json(listings);
    } catch (error) {
      await this.createLog(c, 'getActiveListingsForItem', 'market_listings', 500, undefined);
      return this.sendError(c, 500, 'Error while fetching active market listings');
    }
  }

  @httpGet('/:id')
  public async getMarketListingById(c: Context) {
    const listingId = c.req.param('id');
    try {
      const listing = await this.marketListingService.getMarketListingById(listingId);
      if (!listing) {
        await this.createLog(c, 'getMarketListingById', 'market_listings', 404, undefined);
        return this.sendError(c, 404, 'Market listing not found');
      }
      await this.createLog(c, 'getMarketListingById', 'market_listings', 200, undefined);
      return c.json(listing);
    } catch (error) {
      await this.createLog(c, 'getMarketListingById', 'market_listings', 500, undefined);
      return this.sendError(c, 500, 'Error while fetching the market listing');
    }
  }

  @httpGet('/')
  public async getEnrichedMarketListings(c: Context) {
    const limit = c.req.query('limit');
    const offset = c.req.query('offset');
    try {
      const listings = await this.marketListingService.getEnrichedMarketListings(Number(limit) || 50, Number(offset) || 0);
      await this.createLog(c, 'getEnrichedMarketListings', 'market_listings', 200, undefined);
      return c.json(listings);
    } catch (error) {
      await this.createLog(c, 'getEnrichedMarketListings', 'market_listings', 500, undefined);
      return this.sendError(c, 500, 'Error while fetching enriched market listings');
    }
  }

  @httpGet('/search')
  public async searchMarketListings(c: Context) {
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
    } catch (error) {
      await this.createLog(c, 'searchMarketListings', 'market_listings', 500, undefined);
      return this.sendError(c, 500, 'Error while searching market listings');
    }
  }

  @httpPost('/:id/buy', LoggedCheck)
  public async buyMarketListing(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
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
    } catch (error) {
      await this.createLog(c, 'buyMarketListing', 'market_listings', 500, user.user_id);
      return this.sendError(c, 500, 'Error while buying market listing');
    }
  }
}
