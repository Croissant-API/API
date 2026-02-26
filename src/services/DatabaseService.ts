/* eslint-disable @typescript-eslint/no-unused-vars */
 
import { injectable } from 'inversify';
import { Client } from 'pg';
import 'reflect-metadata';

export interface IDatabaseService {
  request(query: string, params?: unknown[]): Promise<void>;
  read<T>(query: string, params?: unknown[]): Promise<T[]>;
  // the underlying client for more advanced operations
  getClient(): Client;
}

@injectable()
export class DatabaseService implements IDatabaseService {
  private client: Client;

  constructor() {
    // connection string support for Supabase/Postgres
    // you can either provide a full DATABASE_URL or the individual
    // parts DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT.
    if (process.env.DATABASE_URL) {
      console.log('connecting to database via DATABASE_URL');
      this.client = new Client({ connectionString: process.env.DATABASE_URL });
    } else {
      console.log('connecting to database', process.env.DB_HOST, process.env.DB_USER, process.env.DB_NAME);
      this.client = new Client({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
        ssl: { rejectUnauthorized: false },
      });
    }

    this.client
      .connect()
      .then(() => console.log('Database connection established'))
      .catch(err => console.error('Database connection error:', err));
  }

  public getClient(): Client {
    return this.client;
  }

  private convertPlaceholders(query: string): string {
    // replace every '?' with numbered $ placeholders ($1, $2, ...)
    let idx = 0;
    return query.replace(/\?/g, () => `$${++idx}`);
  }

  public async request(query: string, params: unknown[] = []): Promise<void> {
    try {
      const formatted = this.convertPlaceholders(query);
      await this.client.query(formatted, params);
    } catch (err) {
      console.error('Error executing query', err);
      throw err;
    }
  }

  public async read<T>(query: string, params: unknown[] = []): Promise<T[]> {
    try {
      const formatted = this.convertPlaceholders(query);
      const result = await this.client.query<T>(formatted, params);
      const rows = result.rows ?? [];

      // convert JSON strings back into objects, similar to the previous implementation
      return rows.map(row => {
        const copy: any = { ...row };
        for (const key in copy) {
          if (typeof copy[key] === 'string') {
            try {
              copy[key] = JSON.parse(copy[key]);
            } catch {
              // keep original string
            }
          }
        }
        return copy as T;
      });
    } catch (err) {
      console.error('Error reading data', err);
      throw err;
    }
  }

  public async destroy(): Promise<void> {
    await this.client.end();
  }
}

export default DatabaseService;
