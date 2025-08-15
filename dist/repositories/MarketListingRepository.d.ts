import { MarketListing, EnrichedMarketListing } from '../interfaces/MarketListing';
import { InventoryItem } from '../interfaces/Inventory';
import { IDatabaseService } from '../services/DatabaseService';
export declare class MarketListingRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    insertMarketListing(listing: MarketListing): Promise<void>;
    removeInventoryItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
    updateInventoryAmountOrDelete(userId: string, itemId: string, purchasePrice: number): Promise<void>;
    decrementOrDeleteInventory(userId: string, itemId: string): Promise<void>;
    updateBuyOrderToFulfilled(buyOrderId: string, now: string): Promise<void>;
    getMarketListingById(listingId: string, sellerId?: string): Promise<MarketListing | null>;
    updateMarketListingStatus(listingId: string, status: string, updatedAt: string): Promise<void>;
    updateMarketListingSold(listingId: string, buyerId: string, now: string): Promise<void>;
    getMarketListingsByUser(userId: string): Promise<EnrichedMarketListing[]>;
    getActiveListingsForItem(itemId: string): Promise<MarketListing[]>;
    getMarketListingByIdAnyStatus(listingId: string): Promise<MarketListing | null>;
    getEnrichedMarketListings(limit: number, offset: number): Promise<EnrichedMarketListing[]>;
    searchMarketListings(searchTerm: string, limit: number): Promise<EnrichedMarketListing[]>;
    addItemToInventory(inventoryItem: InventoryItem): Promise<void>;
}
