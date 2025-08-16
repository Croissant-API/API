import { IDatabaseService } from "./DatabaseService";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { Inventory } from "../interfaces/Inventory";
import { IUserService } from "./UserService";
export interface IInventoryService {
    getInventory(userId: string): Promise<Inventory>;
    addItem(userId: string, itemId: string, amount: number, metadata?: {
        [key: string]: unknown;
    }, sellable?: boolean, purchasePrice?: number): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number, dataItemIndex?: number): Promise<void>;
    removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: {
        [key: string]: unknown;
    }): Promise<void>;
    transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void>;
    getInventoryRepository(): InventoryRepository;
    getCorrectedUserId(userId: string): Promise<string>;
}
export declare class InventoryService implements IInventoryService {
    private databaseService;
    private userService;
    private inventoryRepository;
    constructor(databaseService: IDatabaseService, userService: IUserService);
    getInventoryRepository(): InventoryRepository;
    getCorrectedUserId(userId: string): Promise<string>;
    getInventory(userId: string): Promise<Inventory>;
    addItem(userId: string, itemId: string, amount: number, metadata?: {
        [key: string]: unknown;
    }, sellable?: boolean, purchasePrice?: number): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: {
        [key: string]: unknown;
    }): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number, dataItemIndex?: number): Promise<void>;
    removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
    transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void>;
}
