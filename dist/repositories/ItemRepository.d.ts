import { Item } from "../interfaces/Item";
import { IDatabaseService } from "../services/DatabaseService";
export declare class ItemRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    createItem(item: Omit<Item, "id">): Promise<void>;
    getItems(filters?: {
        itemId?: string;
        owner?: string;
        showInStore?: boolean;
        deleted?: boolean;
        search?: string;
    }, select?: string, orderBy?: string, limit?: number): Promise<Item[]>;
    getItem(itemId: string): Promise<Item | null>;
    getAllItems(): Promise<Item[]>;
    getStoreItems(): Promise<Item[]>;
    getMyItems(userId: string): Promise<Item[]>;
    updateItem(itemId: string, item: Partial<Omit<Item, "id" | "itemId">>, buildUpdateFields: (obj: Record<string, unknown>, skip?: string[]) => {
        fields: string[];
        values: unknown[];
    }): Promise<void>;
    deleteItem(itemId: string): Promise<void>;
    searchItemsByName(query: string): Promise<Item[]>;
}

