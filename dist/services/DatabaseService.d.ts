import { Db } from 'mongodb';
import 'reflect-metadata';
export interface IDatabaseService {
    getDb(): Promise<Db>;
    destroy(): Promise<void>;
}
export declare class DatabaseService implements IDatabaseService {
    private client;
    private db;
    constructor();
    getDb(): Promise<Db>;
    destroy(): Promise<void>;
}
