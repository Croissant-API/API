export interface IDatabaseService {
    create(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<Awaited<T> | []>;
    update(query: string, params?: unknown[]): Promise<void>;
    delete(query: string, params?: unknown[]): Promise<void>;
}
export declare class DatabaseService {
    private db;
    constructor();
    private init;
    create(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<Awaited<T> | []>;
    update(query: string, params?: unknown[]): Promise<void>;
    delete(query: string, params?: unknown[]): Promise<void>;
}
export default DatabaseService;
