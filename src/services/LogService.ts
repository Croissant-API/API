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
  initialize(): Promise<void>;
}

@injectable()
export class LogService implements ILogService {
  private isInitialized: boolean = false;

  constructor(
    @inject('DatabaseService') private databaseService: IDatabaseService
  ) {}

  public async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.databaseService.initialize();
      await this.ensureTableExists();
      this.isInitialized = true;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async ensureTableExists(): Promise<void> {
    const createTableQuery = `
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
    await this.databaseService.request(createTableQuery);
  }

  async createLog(logData: CreateLogData): Promise<void> {
    await this.ensureInitialized();
    
    const insertQuery = `
      INSERT INTO logs (timestamp, ip_address, table_name, controller, original_path, http_method, request_body, user_id, status_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      new Date().toISOString(),
      logData.ip_address,
      logData.table_name || null,
      logData.controller,
      logData.original_path,
      logData.http_method,
      logData.request_body ? JSON.stringify(logData.request_body) : null,
      logData.user_id || null,
      logData.status_code || null
    ];

    await this.databaseService.request(insertQuery, params);
  }

  async getLogs(limit = 100, offset = 0): Promise<Log[]> {
    await this.ensureInitialized();
    
    const query = `
      SELECT * FROM logs 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    
    return await this.databaseService.read<Log>(query, [limit, offset]);
  }

  async getLogsByController(controller: string, limit = 100): Promise<Log[]> {
    await this.ensureInitialized();
    
    const query = `
      SELECT * FROM logs 
      WHERE controller = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
    
    return await this.databaseService.read<Log>(query, [controller, limit]);
  }

  async getLogsByUser(userId: string, limit = 100): Promise<Log[]> {
    await this.ensureInitialized();
    
    const query = `
      SELECT * FROM logs 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
    
    return await this.databaseService.read<Log>(query, [userId, limit]);
  }

  async getLogsByTable(tableName: string, limit = 100): Promise<Log[]> {
    await this.ensureInitialized();
    
    const query = `
      SELECT * FROM logs 
      WHERE table_name = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
    
    return await this.databaseService.read<Log>(query, [tableName, limit]);
  }

  async deleteOldLogs(daysOld: number): Promise<void> {
    await this.ensureInitialized();
    
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
    const query = `DELETE FROM logs WHERE timestamp < ?`;
    
    await this.databaseService.request(query, [cutoffDate]);
  }

  async getLogStats(): Promise<{
    totalLogs: number;
    logsByController: { controller: string; count: number }[];
    logsByTable: { table_name: string; count: number }[];
  }> {
    await this.ensureInitialized();
    
    const totalQuery = `SELECT COUNT(*) as count FROM logs`;
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
      this.databaseService.read<{ table_name: string; count: number }>(tableQuery)
    ]);

    return {
      totalLogs: totalResult[0]?.count || 0,
      logsByController: controllerResults,
      logsByTable: tableResults
    };
  }
}
