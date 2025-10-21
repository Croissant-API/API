
 
import { injectable } from 'inversify';
import 'reflect-metadata';

export interface IDatabaseService {
  request(query: string, params?: unknown[]): Promise<void>;
  read<T>(query: string, params?: unknown[]): Promise<T[]>;
}

@injectable()
export class DatabaseService implements IDatabaseService {
  private readonly workerUrl: string;
  private readonly authHeader: string;

  constructor() {
    this.workerUrl = process.env.WORKER_URL as string;
    const user = process.env.WORKER_USER as string;
    const pass = process.env.WORKER_PASS as string;
    this.authHeader = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

    
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      await this.runQuery("SELECT 1 as test");
      console.log('Database Worker connection established');
    } catch (err) {
      console.error('Database Worker connection error:', err);
    }
  }

  private async runQuery(sql: string, format: "json" | "csv" = "json"): Promise<{ results: unknown[] } | string> {
    const headers = {
      "Content-Type": "application/json",
      "Accept": format === "csv" ? "text/csv" : "application/json",
      "Authorization": this.authHeader
    };

    const body = JSON.stringify({ query: sql });

    const res = await fetch(this.workerUrl, {
      method: "POST",
      headers,
      body
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Worker error ${res.status}: ${errText}`);
    }

    if (format === "csv") {
      return await res.text();
    } else {
      return await res.json();
    }
  }

  private interpolateParams(query: string, params: unknown[] = []): string {
    let index = 0;
    return query.replace(/\?/g, () => {
      if (index >= params.length) {
        throw new Error('Not enough parameters provided for query');
      }
      const param = params[index++];
      if (typeof param === 'string') {
        return `'${param.replace(/'/g, "''")}'`; 
      } else if (param === null || param === undefined) {
        return 'NULL';
      } else {
        return String(param);
      }
    });
  }

  public async request(query: string, params: unknown[] = []): Promise<void> {
    try {
      const interpolatedQuery = this.interpolateParams(query, params);
      await this.runQuery(interpolatedQuery);
    } catch (err) {
      console.error('Error executing query', err);
      throw err;
    }
  }

  public async read<T>(query: string, params: unknown[] = []): Promise<T[]> {
    try {
      const interpolatedQuery = this.interpolateParams(query, params);
      const result = await this.runQuery(interpolatedQuery, "json");

      
      let rows: unknown[] = [];
      if (typeof result === 'object' && result !== null && 'results' in result) {
        rows = result.results || [];
      }

      if (!Array.isArray(rows)) {
        console.warn('Database query returned non-array result:', rows);
        return [];
      }

      return rows.map((row: unknown) => {
        
        if (typeof row === 'object' && row !== null) {
          const processedRow = { ...row as Record<string, unknown> };
          for (const key in processedRow) {
            if (typeof processedRow[key] === 'string') {
              try {
                const parsed = JSON.parse(processedRow[key] as string);
                processedRow[key] = parsed;
              } catch {
                console.log('Value is not JSON, leaving as string');
              }
            }
          }
          return processedRow as T;
        }
        return row as T;
      });
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


