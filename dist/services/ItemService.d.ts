import { Item } from "interfaces/Item";
import { IDatabaseService } from './DatabaseService';
export interface IItemService {
    createItem(itemId: string, name: string, description: string, price: number, owner: string): Promise<void>;
    getItem(itemId: string): Promise<Item | null>;
    getAllItems(): Promise<Item[]>;
    updateItem(itemId: string, name?: string, description?: string, price?: number): Promise<void>;
    deleteItem(itemId: string): Promise<void>;
}
export declare class ItemService implements IItemService {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    createItem(itemId: string, name: string, description: string, price: number, owner: string): Promise<void>;
    getItem(itemId: string): Promise<Item | null>;
    getAllItems(): Promise<Item[]>;
    updateItem(itemId: string, name?: string, description?: string, price?: number): Promise<void>;
    deleteItem(itemId: string): Promise<void>;
}
