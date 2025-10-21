import 'reflect-metadata';
export interface IDatabaseService {
    request(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<T[]>;
}
export declare class DatabaseService implements IDatabaseService {
    private readonly workerUrl;
    private readonly authHeader;
    constructor();
    private testConnection;
    private runQuery;
    private interpolateParams;
    request(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<T[]>;
    destroy(): Promise<void>;
}
export default DatabaseService;
