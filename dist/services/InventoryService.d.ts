import { IDatabaseService } from "./DatabaseService";
import { Inventory } from "../interfaces/Inventory";
import { IUserService } from "./UserService";
export interface IInventoryService {
    getInventory(userId: string): Promise<Inventory>;
    getItemAmount(userId: string, itemId: string): Promise<number>;
    addItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
}
export declare class InventoryService implements IInventoryService {
    private databaseService;
    private userService;
    constructor(databaseService: IDatabaseService, userService: IUserService);
    getInventory(userId: string): Promise<Inventory>;
    getItemAmount(userId: string, itemId: string): Promise<number>;
    addItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
}
