export interface MarketplaceSale {
    id: string;
    sellerUserId: string;
    itemId: string;
    uniqueId?: string;
    price: number;
    status: 'active' | 'sold' | 'cancelled';
    createdAt: string;
    soldAt?: string;
    buyerUserId?: string;
}
export interface MarketplaceBuyOrder {
    id: string;
    buyerUserId: string;
    itemId: string;
    maxPrice: number;
    status: 'active' | 'filled' | 'cancelled';
    createdAt: string;
    filledAt?: string;
    saleId?: string;
}
export interface MarketplaceTransaction {
    id: string;
    saleId: string;
    buyOrderId: string;
    sellerUserId: string;
    buyerUserId: string;
    itemId: string;
    uniqueId?: string;
    price: number;
    completedAt: string;
}
