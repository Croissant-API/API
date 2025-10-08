export interface BuyOrder {
  id: string;
  buyer_id: string;
  item_id: string;
  price: number;
  status: 'active' | 'fulfilled' | 'cancelled';
  created_at: string;
  updated_at: string;
  fulfilled_at?: string;
}
