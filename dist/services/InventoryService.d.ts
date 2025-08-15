import { IDatabaseService } from "./DatabaseService";
import { Inventory } from "../interfaces/Inventory";
import { IUserService } from "./UserService";
export interface IInventoryService {
    getInventory(userId: string): Promise<Inventory>;
    getItemAmount(userId: string, itemId: string): Promise<number>;
    addItem(userId: string, itemId: string, amount: number, metadata?: {
        [key: string]: unknown;
    }, sellable?: boolean, purchasePrice?: number): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: {
        [key: string]: unknown;
    }): Promise<void>;
    hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
    hasItemWithoutMetadata(userId: string, itemId: string, amount?: number): Promise<boolean>;
    transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void>;
    hasItemWithoutMetadataSellable(userId: string, itemId: string, amount?: number): Promise<boolean>;
    removeSellableItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number): Promise<void>;
}
export declare class InventoryService implements IInventoryService {
    private databaseService;
    private userService;
    private inventoryRepository;
    constructor(databaseService: IDatabaseService, userService: IUserService);
    private getCorrectedUserId;
    getInventory(userId: string): Promise<Inventory>;
    getItemAmount(userId: string, itemId: string): Promise<number>;
    addItem(userId: string, itemId: string, amount: number, metadata?: {
        [key: string]: unknown;
    }, sellable?: boolean, purchasePrice?: number): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: {
        [key: string]: unknown;
    }): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
    hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
    hasItemWithoutMetadata(userId: string, itemId: string, amount?: number): Promise<boolean>;
    hasItemWithoutMetadataSellable(userId: string, itemId: string, amount?: number): Promise<boolean>;
    removeSellableItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number): Promise<void>;
    transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void>;
}
