import { InventoryItem } from './Inventory';

export interface TradeItem extends InventoryItem {
  itemId: string;
  amount: number;
  metadata?: { [key: string]: unknown; _unique_id?: string };
  purchasePrice?: number;
}

export type TradeStatus = 'pending' | 'approved' | 'completed' | 'canceled';

export interface Trade {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserItems: TradeItem[];
  toUserItems: TradeItem[];
  approvedFromUser: boolean;
  approvedToUser: boolean;
  status: TradeStatus;
  createdAt: string;
  updatedAt: string;
}
