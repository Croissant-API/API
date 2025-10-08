import { InventoryItem } from './Inventory';

export interface TradeItem extends InventoryItem {
  itemId: string;
  amount: number;
  metadata?: { [key: string]: unknown; _unique_id?: string }; // Métadonnées complètes incluant _unique_id
  purchasePrice?: number; // Prix d'achat pour identifier les items spécifiques
}

export type TradeStatus = 'pending' | 'approved' | 'completed' | 'canceled';

export interface Trade {
  id: string; // UUID
  fromUserId: string;
  toUserId: string;
  fromUserItems: TradeItem[];
  toUserItems: TradeItem[];
  approvedFromUser: boolean;
  approvedToUser: boolean;
  status: TradeStatus;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}
