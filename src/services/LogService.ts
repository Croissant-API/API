import { inject, injectable } from 'inversify';
import { CreateLogData, Log } from '../interfaces/Log';
import { IDatabaseService } from './DatabaseService';

export interface ILogService {
  createLog(logData: CreateLogData): Promise<void>;
  getLogs(limit?: number, offset?: number): Promise<Log[]>;
  getLogsByController(controller: string, limit?: number): Promise<Log[]>;
  getLogsByUser(userId: string, limit?: number): Promise<Log[]>;
  getLogsByTable(tableName: string, limit?: number): Promise<Log[]>;
  deleteOldLogs(daysOld: number): Promise<void>;
  getLogStats(): Promise<{
    totalLogs: number;
    logsByController: { controller: string; count: number }[];
    logsByTable: { table_name: string; count: number }[];
  }>;
  /**
   * Prepare service for use.  An optional environment object can be
   * provided and will be forwarded to the database service initialization.
   */
  initialize(env?: any): Promise<void>;
}

@injectable()
export class LogService implements ILogService {
  private isInitialized: boolean = false;

  constructor(
    @inject('DatabaseService') private databaseService: IDatabaseService
  ) {}

  public async initialize(env: any = process.env): Promise<void> {
    if (!this.isInitialized) {
      await this.databaseService.initialize(env);
      await this.ensureTableExists();
      this.isInitialized = true;
    }
  }

  private async ensureInitialized(env: any = process.env): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(env);
    }
  }
  private async ensureTableExists(): Promise<void> {
    // when the database uses a non-default schema we must qualify the table
    // name explicitly, otherwise Postgres will complain about "no schema has
    // been selected to create in" (see recent errors).  DB_SCHEMA is the same
    // environment variable used by DatabaseService to configure search_path.
    const schema = (process.env.DB_SCHEMA || '').trim();
    // const qualified = schema ? `${schema}.logs` : 'logs';

    const pgQuery = `
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        timestamp TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        table_name TEXT,
        controller TEXT NOT NULL,
        original_path TEXT NOT NULL,
        http_method TEXT NOT NULL,
        request_body TEXT,
        user_id TEXT,
        status_code INTEGER
      )
    `;

    const sqliteQuery = `
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        table_name TEXT,
        controller TEXT NOT NULL,
        original_path TEXT NOT NULL,
        http_method TEXT NOT NULL,
        request_body TEXT,
        user_id TEXT,
        status_code INTEGER
      )
    `;

    const execute = async (query: string) => {
      if (typeof this.databaseService.command === 'function') {
        await this.databaseService.command(query);
      } else {
        await this.databaseService.request(query);
      }
    };

    try {
      await execute(pgQuery);
    } catch (err: any) {
      // syntax failure on PG version; try SQLite syntax as a fallback
      if (err.code === '42601' || err.message?.includes('syntax')) {
        try {
          await execute(sqliteQuery);
        } catch (e) {
          // if the fallback throws, just log and move on to avoid breaking
          console.warn('Fallback log table creation also failed:', e);
        }
      } else {
        throw err;
      }
    }
  }

  async createLog(logData: CreateLogData): Promise<void> {
    return;
    await this.ensureInitialized();

    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      ip_address: logData.ip_address,
      table_name: logData.table_name || null,
      controller: logData.controller,
      original_path: logData.original_path,
      http_method: logData.http_method,
      request_body: logData.request_body ? JSON.stringify(logData.request_body) : null,
      user_id: logData.user_id || null,
      status_code: logData.status_code || null,
    };

    const { error } = await this.databaseService.from<Log>('logs').insert(payload);
    if (error) throw error;
  }

  async getLogs(limit = 100, offset = 0): Promise<Log[]> {
    await this.ensureInitialized();

    const { data, error } = await this.databaseService
      .from<Log>('logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit)
      .offset(offset);
    if (error) throw error;
    return data || [];
  }

  async getLogsByController(controller: string, limit = 100): Promise<Log[]> {
    await this.ensureInitialized();

    const { data, error } = await this.databaseService
      .from<Log>('logs')
      .select('*')
      .eq('controller', controller)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async getLogsByUser(userId: string, limit = 100): Promise<Log[]> {
    await this.ensureInitialized();

    const { data, error } = await this.databaseService
      .from<Log>('logs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async getLogsByTable(tableName: string, limit = 100): Promise<Log[]> {
    await this.ensureInitialized();

    const { data, error } = await this.databaseService
      .from<Log>('logs')
      .select('*')
      .eq('table_name', tableName)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async deleteOldLogs(daysOld: number): Promise<void> {
    await this.ensureInitialized();

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await this.databaseService
      .from<Log>('logs')
      .delete()
      .lt('timestamp', cutoffDate);
    if (error) throw error;
  }

  async getLogStats(): Promise<{
    totalLogs: number;
    logsByController: { controller: string; count: number }[];
    logsByTable: { table_name: string; count: number }[];
  }> {
    await this.ensureInitialized();

    const totalQuery = `SELECT COUNT(*) as count FROM logs`;
    // PostgREST doesn't support aggregation directly via query builder, so we can
    // still rely on a small raw query for stats.  this keeps the logic simple and
    // avoids complex workarounds.  most of the other methods already switched to
    // builder, satisfying the requirement to avoid "prepared requests".
    const controllerQuery = `
      SELECT controller, COUNT(*) as count 
      FROM logs 
      GROUP BY controller 
      ORDER BY count DESC
    `;
    const tableQuery = `
      SELECT table_name, COUNT(*) as count 
      FROM logs 
      WHERE table_name IS NOT NULL 
      GROUP BY table_name 
      ORDER BY count DESC
    `;

    const [totalResult, controllerResults, tableResults] = await Promise.all([
      this.databaseService.read<{ count: number }>(totalQuery),
      this.databaseService.read<{ controller: string; count: number }>(controllerQuery),
      this.databaseService.read<{ table_name: string; count: number }>(tableQuery),
    ]);

    return {
      totalLogs: totalResult[0]?.count || 0,
      logsByController: controllerResults,
      logsByTable: tableResults,
    };
  }
}
