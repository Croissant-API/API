import { IDatabaseService } from "./DatabaseService";
import { Inventory } from "../interfaces/Inventory";
export interface IInventoryService {
    getInventory(userId: string): Promise<Inventory>;
    addItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
}
export declare class InventoryService implements IInventoryService {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    getInventory(userId: string): Promise<Inventory>;
    addItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
}
