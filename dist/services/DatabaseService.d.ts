import { Knex } from "knex";
export interface IDatabaseService {
    create(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<T[]>;
    update(query: string, params?: unknown[]): Promise<void>;
    delete(query: string, params?: unknown[]): Promise<void>;
    getKnex(): Knex;
}
export declare class DatabaseService implements IDatabaseService {
    private db;
    constructor();
    getKnex(): Knex;
    create(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<T[]>;
    update(query: string, params?: unknown[]): Promise<void>;
    delete(query: string, params?: unknown[]): Promise<void>;
    destroy(): Promise<void>;
}
export default DatabaseService;
