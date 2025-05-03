import sqlite3 from 'sqlite3'
import { Database, open } from 'sqlite'
import { injectable } from 'inversify';

export interface IDatabaseService {
    create(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<Awaited<T> | []>;
    update(query: string, params?: unknown[]): Promise<void>;
    delete(query: string, params?: unknown[]): Promise<void>;
}

@injectable()
export class DatabaseService {
    private db: Database | undefined;

    constructor() {
        this.init().then(db => this.db = db);
    }

    private async init(): Promise<Database> {
        try {
            this.db = await open({
                filename: __dirname + '/../../database.db',
                driver: sqlite3.Database
            });
            console.log("Database opened");
            return this.db;
        } catch (err) {
            console.error("Error opening database", err);
            throw err;
        }
    }

    public create(query: string, params: unknown[] = []): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) {
                const error = new Error("Database not initialized");
                console.error(error.message);
                return reject(error);
            }
            try {
                this.db.run(query, params);
                resolve();
            } catch (err) {
                console.error("Error creating data", err);
                reject(err);
            }
        });
    }

    public read<T>(query: string, params: unknown[] = []): Promise<Awaited<T> | []> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise<Awaited<T> | []>(async (resolve, reject) => {
            if (!this.db) {
                const error = new Error("Database not initialized");
                console.error(error.message);
                return reject(error);
            }
            try {
                const rows = await this.db.all<T>(query, params);
                if (!rows) {
                    return resolve([]);
                }
                resolve(rows);
            } catch (err) {
                console.error("Error reading data", err);
                reject(err);
            }
        });
    }

    public update(query: string, params: unknown[] = []): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) {
                const error = new Error("Database not initialized");
                console.error(error.message);
                return reject(error);
            }
            try {
                this.db.run(query, params);
                resolve();
            } catch (err) {
                console.error("Error updating data", err);
                reject(err);
            }
        });
    }

    public delete(query: string, params: unknown[] = []): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) {
                const error = new Error("Database not initialized");
                console.error(error.message);
                return reject(error);
            }
            try {
                this.db.run(query, params);
                resolve();
            } catch (err) {
                console.error("Error deleting data", err);
                reject(err);
            }
        });
    }
}

export default DatabaseService;