export interface IDatabaseService {
    create(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<T[] | any[] | any>;
    update(query: string, params?: unknown[]): Promise<void>;
    delete(query: string, params?: unknown[]): Promise<void>;
}
export declare class DatabaseService implements IDatabaseService {
    private db;
    constructor();
    private init;
    private ensureDb;
    create(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<T[]>;
    update(query: string, params?: unknown[]): Promise<void>;
    delete(query: string, params?: unknown[]): Promise<void>;
}
export default DatabaseService;
