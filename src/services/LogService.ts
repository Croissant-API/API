import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Log, CreateLogData } from "../interfaces/Log";

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
}

@injectable()
export class LogService implements ILogService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {}

  async createLog(logData: CreateLogData): Promise<void> {
    const query = `
      INSERT INTO logs (
        timestamp, ip_address, table_name, controller, 
        original_path, http_method, request_body, user_id, status_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    await this.databaseService.request(query, params);
  }

  async getLogs(limit = 100, offset = 0): Promise<Log[]> {
    const query = `
      SELECT * FROM logs 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    return await this.databaseService.read<Log>(query, [limit, offset]);
  }

  async getLogsByController(controller: string, limit = 100): Promise<Log[]> {
    const query = `
      SELECT * FROM logs 
      WHERE controller = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
    return await this.databaseService.read<Log>(query, [controller, limit]);
  }

  async getLogsByUser(userId: string, limit = 100): Promise<Log[]> {
    const query = `
      SELECT * FROM logs 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
    return await this.databaseService.read<Log>(query, [userId, limit]);
  }

  async getLogsByTable(tableName: string, limit = 100): Promise<Log[]> {
    const query = `
      SELECT * FROM logs 
      WHERE table_name = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
    return await this.databaseService.read<Log>(query, [tableName, limit]);
  }

  async deleteOldLogs(daysOld: number): Promise<void> {
    const query = `
      DELETE FROM logs 
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `;
    await this.databaseService.request(query, [daysOld]);
  }

  // Méthodes utilitaires pour les statistiques
  async getLogStats(): Promise<{
    totalLogs: number;
    logsByController: { controller: string; count: number }[];
    logsByTable: { table_name: string; count: number }[];
  }> {
    const totalQuery = "SELECT COUNT(*) as count FROM logs";
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

    const [totalResult, controllerStats, tableStats] = await Promise.all([
      this.databaseService.read<{ count: number }>(totalQuery),
      this.databaseService.read<{ controller: string; count: number }>(controllerQuery),
      this.databaseService.read<{ table_name: string; count: number }>(tableQuery)
    ]);

    return {
      totalLogs: totalResult[0]?.count || 0,
      logsByController: controllerStats,
      logsByTable: tableStats
    };
  }
}