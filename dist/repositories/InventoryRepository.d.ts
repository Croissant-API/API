import { InventoryItem } from "../interfaces/Inventory";
import { IDatabaseService } from "../services/DatabaseService";
export declare class InventoryRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    deleteNonExistingItems(userId: string): Promise<void>;
    getInventory(filters?: {
        userId?: string;
        itemId?: string;
        sellable?: boolean;
        purchasePrice?: number;
        uniqueId?: string;
        minAmount?: number;
    }): Promise<InventoryItem[]>;
    getInventoryItems(userId: string): Promise<InventoryItem[]>;
    getItemAmount(userId: string, itemId: string): Promise<number>;
    hasItemWithoutMetadata(userId: string, itemId: string, amount: number): Promise<boolean>;
    hasItemWithoutMetadataSellable(userId: string, itemId: string, amount: number): Promise<boolean>;
    addItem(userId: string, itemId: string, amount: number, metadata: {
        [key: string]: unknown;
    } | undefined, sellable: boolean, purchasePrice: number | undefined, uuidv4: () => string): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: object): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number, dataItemIndex?: number): Promise<void>;
    removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
    removeSellableItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number, dataItemIndex?: number): Promise<void>;
    transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void>;
}
