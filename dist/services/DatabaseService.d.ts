import { Knex } from 'knex';
import 'reflect-metadata';
export interface IDatabaseService {
    request(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<T[]>;
    getKnex(): Knex;
}
export declare class DatabaseService implements IDatabaseService {
    private db;
    constructor();
    getKnex(): Knex;
    request(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<T[]>;
    destroy(): Promise<void>;
}
export default DatabaseService;
