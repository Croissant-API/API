import { Item } from "interfaces/Item";
import { IDatabaseService } from "./DatabaseService";
export interface IItemService {
    createItem(item: Omit<Item, "id">): Promise<void>;
    getItem(itemId: string): Promise<Item | null>;
    getAllItems(): Promise<Item[]>;
    updateItem(itemId: string, item: Partial<Omit<Item, "id" | "itemId" | "owner">>): Promise<void>;
    deleteItem(itemId: string): Promise<void>;
    searchItemsByName(query: string): Promise<Item[]>;
    transferOwnership(itemId: string, newOwnerId: string): Promise<void>;
}
export declare class ItemService implements IItemService {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    createItem(item: Omit<Item, "id">): Promise<void>;
    getItem(itemId: string): Promise<Item | null>;
    getAllItems(): Promise<Item[]>;
    updateItem(itemId: string, item: Partial<Omit<Item, "id" | "itemId">>): Promise<void>;
    deleteItem(itemId: string): Promise<void>;
    /**
     * Search items by name, only those with showInStore = true and not deleted
     */
    searchItemsByName(query: string): Promise<Item[]>;
    transferOwnership(itemId: string, newOwnerId: string): Promise<void>;
}
