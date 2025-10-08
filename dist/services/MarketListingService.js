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
exports.MarketListingService = void 0;
const uuid_1 = require("uuid");
const DatabaseService_1 = require("./DatabaseService");
const MarketListingRepository_1 = require("../repositories/MarketListingRepository");
const inversify_1 = require("inversify");
let MarketListingService = class MarketListingService {
    constructor(databaseService, buyOrderService) {
        this.databaseService = databaseService;
        this.buyOrderService = buyOrderService;
        
        this.deserializeMarketListing = (row) => ({
            id: row.id,
            seller_id: row.seller_id,
            item_id: row.item_id,
            price: row.price,
            status: row.status,
            metadata: row.metadata,
            created_at: row.created_at,
            updated_at: row.updated_at,
            sold_at: row.sold_at || undefined,
            buyer_id: row.buyer_id || undefined,
            rarity: row.rarity || 'common',
            custom_url_link: row.custom_url_link || undefined
        });
        this.marketListingRepository = new MarketListingRepository_1.MarketListingRepository(this.databaseService);
    }
    
    async createMarketListing(sellerId, inventoryItem, sellingPrice) {
        const now = new Date().toISOString();
        
        if (!inventoryItem.sellable && !inventoryItem.metadata) {
            throw new Error('This item cannot be sold');
        }
        if (inventoryItem.user_id !== sellerId) {
            throw new Error('You do not own this item');
        }
        if (inventoryItem.amount < 1) {
            throw new Error('Not enough quantity to sell');
        }
        if (sellingPrice <= 0) {
            throw new Error('Selling price must be positive');
        }
        
        const marketListing = {
            id: (0, uuid_1.v4)(),
            seller_id: sellerId,
            item_id: inventoryItem.item_id,
            price: sellingPrice,
            purchasePrice: inventoryItem.purchasePrice || undefined,
            status: 'active',
            metadata: inventoryItem.metadata,
            created_at: now,
            updated_at: now,
            rarity: inventoryItem.rarity || 'common',
            custom_url_link: inventoryItem.custom_url_link || undefined
        };
        await this.marketListingRepository.insertMarketListing(marketListing);
        if (inventoryItem.metadata && inventoryItem.metadata._unique_id && typeof inventoryItem.metadata._unique_id === 'string') {
            await this.marketListingRepository.removeInventoryItemByUniqueId(sellerId, inventoryItem.item_id, inventoryItem.metadata._unique_id);
        }
        else if (inventoryItem.purchasePrice) {
            await this.marketListingRepository.updateInventoryAmountOrDelete(sellerId, inventoryItem.item_id, inventoryItem.purchasePrice);
        }
        else {
            await this.marketListingRepository.decrementOrDeleteInventory(sellerId, inventoryItem.item_id);
        }
        const matchedBuyOrder = await this.buyOrderService.matchSellOrder(marketListing.item_id, marketListing.price);
        if (matchedBuyOrder) {
            await this.marketListingRepository.updateBuyOrderToFulfilled(matchedBuyOrder.id, now);
            await this.buyMarketListing(marketListing.id, matchedBuyOrder.buyer_id);
        }
        return marketListing;
    }
    
    async cancelMarketListing(listingId, sellerId) {
        const listing = await this.marketListingRepository.getMarketListingById(listingId, sellerId);
        if (!listing)
            throw new Error('Market listing not found or already processed');
        const metadata = typeof listing.metadata === 'string'
            ? JSON.parse(listing.metadata)
            : (listing.metadata || {});
        await this.marketListingRepository.updateMarketListingStatus(listingId, 'cancelled', new Date().toISOString());
        const inventoryItem = {
            user_id: sellerId,
            item_id: listing.item_id,
            amount: 1,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            sellable: true,
            purchasePrice: listing.purchasePrice || undefined,
            rarity: listing.rarity,
            custom_url_link: listing.custom_url_link || undefined
        };
        await this.marketListingRepository.addItemToInventory(inventoryItem);
    }
    async buyMarketListing(listingId, buyerId) {
        const now = new Date().toISOString();
        const listing = await this.marketListingRepository.getMarketListingById(listingId);
        if (!listing)
            throw new Error('Market listing not found or already sold');
        
        await this.marketListingRepository.updateMarketListingSold(listingId, buyerId, now);
        const inventoryItem = {
            user_id: buyerId,
            item_id: listing.item_id,
            amount: 1,
            metadata: listing.metadata,
            sellable: true,
            purchasePrice: listing.purchasePrice || undefined,
            rarity: listing.rarity || "common",
            custom_url_link: listing.custom_url_link
        };
        await this.marketListingRepository.addItemToInventory(inventoryItem);
        return { ...listing, status: 'sold', buyer_id: buyerId, sold_at: now };
    }
    
    async getMarketListingsByUser(userId) {
        const listings = await this.marketListingRepository.getMarketListingsByUser(userId);
        return listings.map(row => ({
            ...this.deserializeMarketListing(row),
            item_name: row.item_name,
            item_description: row.item_description,
            item_icon_hash: row.item_icon_hash
        }));
    }
    
    async getActiveListingsForItem(itemId) {
        const listings = await this.marketListingRepository.getActiveListingsForItem(itemId);
        return listings.map(this.deserializeMarketListing);
    }
    
    async getMarketListingById(listingId) {
        const listing = await this.marketListingRepository.getMarketListingByIdAnyStatus(listingId);
        return listing ? this.deserializeMarketListing(listing) : null;
    }
    
    async getEnrichedMarketListings(limit = 50, offset = 0) {
        const listings = await this.marketListingRepository.getEnrichedMarketListings(limit, offset);
        return listings.map(row => ({
            ...this.deserializeMarketListing(row),
            item_name: row.item_name,
            item_description: row.item_description,
            item_icon_hash: row.item_icon_hash
        }));
    }
    
    async searchMarketListings(searchTerm, limit = 50) {
        const listings = await this.marketListingRepository.searchMarketListings(searchTerm, limit);
        return listings.map(row => ({
            ...this.deserializeMarketListing(row),
            item_name: row.item_name,
            item_description: row.item_description,
            item_icon_hash: row.item_icon_hash
        }));
    }
};
exports.MarketListingService = MarketListingService;
exports.MarketListingService = MarketListingService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)('DatabaseService')),
    __param(1, (0, inversify_1.inject)('BuyOrderService')),
    __metadata("design:paramtypes", [DatabaseService_1.DatabaseService, Object])
], MarketListingService);

