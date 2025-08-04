export interface InventoryItem {
    user_id: string;
    item_id: string;
    amount: number;
    name?: string;
    iconHash?: string;
    description?: string;
    metadata?: {
        [key: string]: unknown;
    };
    sellable: boolean;
    purchasePrice?: number;
}
export interface Inventory {
    user_id: string;
    inventory: InventoryItem[];
}
