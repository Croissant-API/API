export interface MarketplaceSale {
  id: string;
  seller_user_id: string;
  item_id: string;
  unique_id?: string;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  created_at: string;
  sold_at?: string;
  buyer_user_id?: string;
}

export interface MarketplaceBuyOrder {
  id: string;
  buyer_user_id: string;
  item_id: string;
  max_price: number;
  status: 'active' | 'filled' | 'cancelled';
  created_at: string;
  filled_at?: string;
  sale_id?: string;
}

export interface CreateSaleRequest {
  item_id: string;
  unique_id?: string;
  price: number;
}

export interface CreateBuyOrderRequest {
  item_id: string;
  max_price: number;
  quantity?: number; // Pour créer plusieurs ordres d'achat
}

export interface MarketplaceSaleWithDetails extends MarketplaceSale {
  item_name: string;
  item_description?: string;
  item_icon_hash?: string;
  seller_username: string;
  buyer_username?: string;
  metadata?: { [key: string]: unknown };
}

export interface MarketplaceBuyOrderWithDetails extends MarketplaceBuyOrder {
  item_name: string;
  item_description?: string;
  item_icon_hash?: string;
  buyer_username: string;
}