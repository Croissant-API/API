import { InventoryItem } from "../interfaces/Inventory";
import { IDatabaseService } from "../services/DatabaseService";
export declare class InventoryRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    deleteNonExistingItems(userId: string): Promise<void>;
    getInventoryItems(userId: string): Promise<InventoryItem[]>;
    getItemAmount(userId: string, itemId: string): Promise<number>;
    addItem(userId: string, itemId: string, amount: number, metadata: {
        [key: string]: unknown;
    } | undefined, sellable: boolean, purchasePrice: number | undefined, uuidv4: () => string): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: object): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
    hasItemWithoutMetadata(userId: string, itemId: string, amount: number): Promise<boolean>;
    hasItemWithoutMetadataSellable(userId: string, itemId: string, amount: number): Promise<boolean>;
    removeSellableItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number): Promise<void>;
    transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void>;
}
