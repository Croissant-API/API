export interface InventoryItem {
  user_id: string;
  item_id: string;
  amount: number;
  metadata?: { [key: string]: unknown };
  // Données de l'item
  itemId?: string;
  name?: string;
  description?: string;
  iconHash?: string;
  price?: number;
  owner?: string;
  showInStore?: boolean;
}

export interface Inventory {
  user_id: string;
  inventory: InventoryItem[];
}