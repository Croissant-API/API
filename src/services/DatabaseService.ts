import { injectable } from 'inversify';
import { Db, MongoClient } from 'mongodb';

import 'reflect-metadata';

export interface IDatabaseService {
  // request(query: string, params?: unknown[]): Promise<void>;
  // read<T>(query: string, params?: unknown[]): Promise<T[]>;
  getDb(): Promise<Db>;
  destroy(): Promise<void>;
}

@injectable()
export class DatabaseService implements IDatabaseService {
  private client: MongoClient;
  private db: Db | null = null;

  constructor() {
    this.client = new MongoClient(process.env.MONGO_URI as string);

    this.client.connect()
      .then(async () => {
        this.db = this.client.db(process.env.MONGO_DB);
        await this.db.command({ ping: 1 });
        console.log('MongoDB connection established');
      })
      .catch(err => {
        console.error('MongoDB connection error:', err);
      });
  }

  public async getDb(): Promise<Db> {
    // if (!this.db) {
    //   throw new Error('Database not initialized');
    // }
    if (!this.db) {
      // Wait for the database to be initialized
      await new Promise<void>((resolve, reject) => {
        const checkDb = () => {
          if (this.db) {
            resolve();
          }
          setTimeout(checkDb, 100);
        };
        checkDb();
      });
    }

    // We assume that by the time we get here, the database is initialized. If not, it will throw an error.
    return this.db as Db;
  }

  public async destroy(): Promise<void> {
    await this.client.close();
  }
}