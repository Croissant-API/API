export interface Inventory {
    user_id: string;
    inventory: InventoryItem[];
}
export interface InventoryItem {
    user_id: string;
    item_id: string;
    amount: number;
    metadata?: {
        [key: string]: unknown;
        _unique_id?: string;
    };
}
