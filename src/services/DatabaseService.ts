import { Knex, knex } from "knex";
import { injectable } from "inversify";
import "reflect-metadata";

export interface IDatabaseService {
  request(query: string, params?: unknown[]): Promise<void>;
  read<T>(query: string, params?: unknown[]): Promise<T[]>;
  getKnex(): Knex;
}

@injectable()
export class DatabaseService implements IDatabaseService {
  private db: Knex;

  constructor() {
    console.log(process.env.DB_HOST, process.env.DB_USER, process.env.DB_NAME);

    this.db = knex({
      client: "mysql",
      connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        port: 3306,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
      },
      useNullAsDefault: true,
    });

    this.db
      .raw("SELECT 1")
      .then(() => {
        console.log("Database connection established");
      })
      .catch((err) => {
        console.error("Database connection error:", err);
      });
  }

  public getKnex(): Knex {
    return this.db;
  }

  public async request(query: string, params: unknown[] = []): Promise<void> {
    try {
      await this.db.raw(query, params);
    } catch (err) {
      console.error("Error executing query", err);
      throw err;
    }
  }

  public async read<T>(query: string, params: unknown[] = []): Promise<T[]> {
    try {
      const result = await this.db.raw(query, params);
      // Pour MySQL, result = [rows, fields]
      const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;

      // Vérifier que rows est un tableau
      if (!Array.isArray(rows)) {
        console.warn("Database query returned non-array result:", rows);
        return [];
      }

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

  public async destroy(): Promise<void> {
    await this.db.destroy();
  }
}

export default DatabaseService;
