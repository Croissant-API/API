import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import { injectable } from "inversify";

export interface IDatabaseService {
  create(query: string, params?: unknown[]): Promise<void>;
  read<T>(query: string, params?: unknown[]): Promise<T[]>;
  update(query: string, params?: unknown[]): Promise<void>;
  delete(query: string, params?: unknown[]): Promise<void>;
}

@injectable()
export class DatabaseService implements IDatabaseService {
  private db: Database | undefined;

  constructor() {
    this.init().then((db) => (this.db = db));
  }

  private async init(): Promise<Database> {
    try {
      this.db = await open({
        filename: __dirname + "/../../database.db",
        driver: sqlite3.Database,
      });
      return this.db;
    } catch (err) {
      console.error("Error opening database", err);
      throw err;
    }
  }

  private ensureDb(): Database {
    if (!this.db) throw new Error("Database not initialized");
    return this.db;
  }

  public async create(query: string, params: unknown[] = []): Promise<void> {
    try {
      await this.ensureDb().run(query, params);
    } catch (err) {
      console.error("Error creating data", err);
      throw err;
    }
  }

  public async read<T>(query: string, params: unknown[] = []): Promise<T[]> {
    try {
      const rows = await this.ensureDb().all(query, params);
      if (!rows) return [];

      return rows.map((row: { [key: string]: string }) => {
        for (const key in row) {
          if (typeof row[key] === "string") {
            try {
              try {
                const parsed = JSON.parse(row[key]);
                row[key] = parsed;
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (e: unknown) {
                // Not a JSON string, leave as is
              }
            } catch (e: unknown) {
              console.warn(`Failed to parse JSON for key ${key}:`, e);
              // Not a JSON string, leave as is
            }
          }
        }
        return row as T;
      });
    } catch (err) {
      console.error("Error reading data", err);
      throw err;
    }
  }

  public async update(query: string, params: unknown[] = []): Promise<void> {
    try {
      await this.ensureDb().run(query, params);
    } catch (err) {
      console.error("Error updating data", err);
      throw err;
    }
  }

  public async delete(query: string, params: unknown[] = []): Promise<void> {
    try {
      await this.ensureDb().run(query, params);
    } catch (err) {
      console.error("Error deleting data", err);
      throw err;
    }
  }
}

export default DatabaseService;
