import { InventoryItem } from '../interfaces/Inventory';
import { EnrichedMarketListing, MarketListing } from '../interfaces/MarketListing';
import { IBuyOrderService } from './BuyOrderService';
import { DatabaseService } from './DatabaseService';
export interface IMarketListingService {
    createMarketListing(sellerId: string, inventoryItem: InventoryItem, sellingPrice: number): Promise<MarketListing>;
    cancelMarketListing(listingId: string, sellerId: string): Promise<void>;
    buyMarketListing(listingId: string, buyerId: string): Promise<MarketListing>;
    getMarketListingsByUser(userId: string): Promise<EnrichedMarketListing[]>;
    getActiveListingsForItem(itemId: string): Promise<MarketListing[]>;
    getMarketListingById(listingId: string): Promise<MarketListing | null>;
    getEnrichedMarketListings(limit?: number, offset?: number): Promise<EnrichedMarketListing[]>;
    searchMarketListings(searchTerm: string, limit?: number): Promise<EnrichedMarketListing[]>;
}
export declare class MarketListingService implements IMarketListingService {
    private databaseService;
    private buyOrderService;
    private marketListingRepository;
    constructor(databaseService: DatabaseService, buyOrderService: IBuyOrderService);
    createMarketListing(sellerId: string, inventoryItem: InventoryItem, sellingPrice: number): Promise<MarketListing>;
    cancelMarketListing(listingId: string, sellerId: string): Promise<void>;
    buyMarketListing(listingId: string, buyerId: string): Promise<MarketListing>;
    getMarketListingsByUser(userId: string): Promise<EnrichedMarketListing[]>;
    getActiveListingsForItem(itemId: string): Promise<MarketListing[]>;
    getMarketListingById(listingId: string): Promise<MarketListing | null>;
    getEnrichedMarketListings(limit?: number, offset?: number): Promise<EnrichedMarketListing[]>;
    searchMarketListings(searchTerm: string, limit?: number): Promise<EnrichedMarketListing[]>;
    private deserializeMarketListing;
}
