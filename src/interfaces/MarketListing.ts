export interface MarketListing {
    id: string;
    seller_id: string;
    item_id: string;
    price: number;
    status: MarketListingStatus;
    metadata?: { [key: string]: unknown; _unique_id?: string };
    created_at: string;
    updated_at: string;
    sold_at?: string;
    buyer_id?: string;
    purchasePrice?: number;
}

export type MarketListingStatus = "active" | "sold" | "cancelled";

export interface EnrichedMarketListing extends MarketListing {
    item_name: string;
    item_description: string;
    item_icon_hash: string;

    sellerName?: string;
}

export interface CreateMarketListingRequest {
    item_id: string;
    price: number;
    metadata?: { [key: string]: unknown; _unique_id?: string };
}
