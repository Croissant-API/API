import { IDatabaseService } from "./DatabaseService";
import { Inventory } from "../interfaces/Inventory";
import { IUserService } from "./UserService";
export interface IInventoryService {
    getInventory(userId: string): Promise<Inventory>;
    getItemAmount(userId: string, itemId: string): Promise<number>;
    addItem(userId: string, itemId: string, amount: number, metadata?: {
        [key: string]: unknown;
    }): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: {
        [key: string]: unknown;
    }): Promise<void>;
    hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
    hasItemWithoutMetadata(userId: string, itemId: string, amount?: number): Promise<boolean>;
}
export declare class InventoryService implements IInventoryService {
    private databaseService;
    private userService;
    constructor(databaseService: IDatabaseService, userService: IUserService);
    private getCorrectedUserId;
    private parseMetadata;
    getInventory(userId: string): Promise<Inventory>;
    getItemAmount(userId: string, itemId: string): Promise<number>;
    addItem(userId: string, itemId: string, amount: number, metadata?: {
        [key: string]: unknown;
    }): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: {
        [key: string]: unknown;
    }): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
    hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
    hasItemWithoutMetadata(userId: string, itemId: string, amount?: number): Promise<boolean>;
}
