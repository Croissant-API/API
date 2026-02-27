import { InventoryItem } from '../interfaces/Inventory';
import { EnrichedMarketListing, MarketListing } from '../interfaces/MarketListing';
import { IDatabaseService } from '../services/DatabaseService';
export declare class MarketListingRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    insertMarketListing(listing: MarketListing): Promise<void>;
    removeInventoryItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
    updateInventoryAmountOrDelete(userId: string, itemId: string, purchasePrice: number): Promise<void>;
    decrementOrDeleteInventory(userId: string, itemId: string): Promise<void>;
    getMarketListings(filters?: {
        id?: string;
        sellerId?: string;
        itemId?: string;
        status?: string;
    }, select?: string, orderBy?: string, limit?: number): Promise<MarketListing[]>;
    getMarketListingById(listingId: string, sellerId?: string): Promise<MarketListing | null>;
    getMarketListingByIdAnyStatus(listingId: string): Promise<MarketListing | null>;
    getMarketListingsByUser(userId: string): Promise<EnrichedMarketListing[]>;
    getActiveListingsForItem(itemId: string): Promise<MarketListing[]>;
    getEnrichedMarketListings(limit: number, offset: number): Promise<EnrichedMarketListing[]>;
    searchMarketListings(searchTerm: string, limit: number): Promise<EnrichedMarketListing[]>;
    updateMarketListingStatus(listingId: string, status: string, updatedAt: string): Promise<void>;
    updateMarketListingSold(listingId: string, buyerId: string, now: string): Promise<void>;
    updateBuyOrderToFulfilled(buyOrderId: string, now: string): Promise<void>;
    addItemToInventory(inventoryItem: InventoryItem): Promise<void>;
}
