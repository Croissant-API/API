import { Knex, knex } from "knex";
import { injectable } from "inversify";

export interface IDatabaseService {
  getKnex(): Knex;
  // Legacy methods for backward compatibility - will be deprecated
  create(query: string, params?: unknown[]): Promise<void>;
  read<T>(query: string, params?: unknown[]): Promise<T[]>;
  update(query: string, params?: unknown[]): Promise<void>;
  delete(query: string, params?: unknown[]): Promise<void>;
}

@injectable()
export class DatabaseService implements IDatabaseService {
  private db: Knex;

  constructor() {
    this.db = knex({
      client: "sqlite3",
      connection: {
        filename: __dirname + "/../../database.db",
      },
      useNullAsDefault: true,
    });
  }

  public getKnex(): Knex {
    return this.db;
  }

  // Legacy methods for backward compatibility - DEPRECATED: Use getKnex() instead
  public async create(query: string, params: unknown[] = []): Promise<void> {
    console.warn("DatabaseService.create() is deprecated. Use getKnex() instead.");
    try {
      await this.db.raw(query, params);
    } catch (err) {
      console.error("Error creating data", err);
      throw err;
    }
  }

  public async read<T>(query: string, params: unknown[] = []): Promise<T[]> {
    console.warn("DatabaseService.read() is deprecated. Use getKnex() instead.");
    try {
      const result = await this.db.raw(query, params);
      const rows = result || [];

      return rows.map((row: { [key: string]: string }) => {
        for (const key in row) {
          if (typeof row[key] === "string") {
            try {
              const parsed = JSON.parse(row[key]);
              row[key] = parsed;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e: unknown) {
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
    console.warn("DatabaseService.update() is deprecated. Use getKnex() instead.");
    try {
      await this.db.raw(query, params);
    } catch (err) {
      console.error("Error updating data", err);
      throw err;
    }
  }

  public async delete(query: string, params: unknown[] = []): Promise<void> {
    console.warn("DatabaseService.delete() is deprecated. Use getKnex() instead.");
    try {
      await this.db.raw(query, params);
    } catch (err) {
      console.error("Error deleting data", err);
      throw err;
    }
  }

  public async destroy(): Promise<void> {
    await this.db.destroy();
  }
}

export default DatabaseService;
