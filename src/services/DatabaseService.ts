/* eslint-disable @typescript-eslint/no-explicit-any */
import { injectable } from 'inversify';
import 'reflect-metadata';

export interface IDatabaseService {
  request(query: string, params?: unknown[]): Promise<void>;
  read<T>(query: string, params?: unknown[]): Promise<T[]>;
  initialize(env: any): Promise<void>;
}

@injectable()
export class DatabaseService implements IDatabaseService {
  private db: any = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() { }

  public async initialize(env: any): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationPromise = this.performInitialization(env);
    return this.initializationPromise;
  }

  private async performInitialization(env: any): Promise<void> {
    try {
      // if (env?.d1_local) this.db = env.d1_local;
      // else if (env?.CROISSANT) this.db = env.CROISSANT;
      if (env?.CROISSANT) this.db = env.CROISSANT;
      this.isInitialized = true;
      console.log('D1 binding established');
    } catch (err) {
      console.error('D1 binding error:', err);
      this.initializationPromise = null;
      throw err;
    }
  }

  private async ensureInitialized(env: any): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(env);
    }
  }

  private interpolateParams(query: string, params: unknown[] = []): [string, unknown[]] {
    // On laisse les ? dans la requête, D1 gère les paramètres
    return [query, params];
  }

  private async runQuery(sql: string, params: unknown[] = [], format: "json" | "csv" = "json"): Promise<{ results: unknown[] } | string> {
    const stmt = this.db.prepare(sql);
    const res = await stmt.bind(...params).all();
    if (format === "csv") {
      // Conversion CSV si besoin
      const rows = res && res.results ? res.results : [];
      if (!Array.isArray(rows) || rows.length === 0) return "";
      const keys = Object.keys(rows[0]);
      const escape = (v: any) => {
        if (v === null || v === undefined) return "";
        const s = String(v);
        if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const header = keys.join(",");
      const lines = rows.map(r => keys.map(k => escape(r[k])).join(","));
      return [header, ...lines].join("\n");
    }

    // Parse response recursively
    const parseRecursively = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'string') {
        try {
          const parsed = JSON.parse(obj);
          return parseRecursively(parsed);
        } catch {
          return obj;
        }
      }
      if (Array.isArray(obj)) {
        return obj.map(item => parseRecursively(item));
      }
      if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = parseRecursively(value);
        }
        return result;
      }
      return obj;
    };
    // console.log('Query result:', parseRecursively(res));
    return parseRecursively(res);

  }

  public async request(query: string, params: unknown[] = []): Promise<void> {
    // await this.ensureInitialized(env);
    try {
      const [sql, sqlParams] = this.interpolateParams(query, params);
      await this.runQuery(sql, sqlParams);
    } catch (err) {
      console.error('Error executing query', err);
      throw err;
    }
  }

  public async read<T>(query: string, params: unknown[] = []): Promise<T[]> {
    // await this.ensureInitialized();
    try {
      const [sql, sqlParams] = this.interpolateParams(query, params);
      const result = await this.runQuery(sql, sqlParams, "json");
      let rows: unknown[] = [];
      if (typeof result === 'object' && result !== null && 'results' in result) {
        rows = (result as any).results || [];
      }
      if (!Array.isArray(rows)) {
        console.warn('Database query returned non-array result:', rows);
        return [];
      }
      return rows as T[];
    } catch (err) {
      console.error('Error reading data', err);
      throw err;
    }
  }

  public async destroy(): Promise<void> {
    console.log('DatabaseService destroyed');
  }
}

export default DatabaseService;


