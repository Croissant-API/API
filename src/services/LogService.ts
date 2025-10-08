import { parse } from 'csv-parse/sync';
import * as fs from 'fs/promises';
import { injectable } from 'inversify';
import * as path from 'path';
import { CreateLogData, Log } from '../interfaces/Log';

const LOG_FILE = path.join(__dirname, '../../logs.csv');

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
  private async ensureFileExists() {
    try {
      await fs.access(LOG_FILE);
    } catch {
      const header = 'timestamp,ip_address,table_name,controller,original_path,http_method,request_body,user_id,status_code\n';
      await fs.writeFile(LOG_FILE, header, 'utf8');
    }
  }

  private async readLogs(): Promise<Log[]> {
    await this.ensureFileExists();
    const content = await fs.readFile(LOG_FILE, 'utf8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
    });
    return records as Log[];
  }

  private async writeLogs(logs: Log[]): Promise<void> {
    const header = 'timestamp,ip_address,table_name,controller,original_path,http_method,request_body,user_id,status_code\n';
    const lines = logs.map(log => [log.timestamp, log.ip_address, log.table_name ?? '', log.controller, log.original_path, log.http_method, log.request_body ? JSON.stringify(log.request_body) : '', log.user_id ?? '', log.status_code ?? ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    await fs.writeFile(LOG_FILE, header + lines.join('\n'), 'utf8');
  }

  async createLog(logData: CreateLogData): Promise<void> {
    await this.ensureFileExists();
    const log: Log = {
      timestamp: new Date().toISOString(),
      ip_address: logData.ip_address,
      table_name: logData.table_name ?? '',
      controller: logData.controller,
      original_path: logData.original_path,
      http_method: logData.http_method,
      request_body: logData.request_body ? JSON.stringify(logData.request_body) : '',
      user_id: logData.user_id ?? '',
      status_code: logData.status_code,
    };
    const line = [log.timestamp, log.ip_address, log.table_name, log.controller, log.original_path, log.http_method, log.request_body, log.user_id, log.status_code].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    await fs.appendFile(LOG_FILE, line + '\n', 'utf8');
  }

  async getLogs(limit = 100, offset = 0): Promise<Log[]> {
    const logs = await this.readLogs();
    return logs.reverse().slice(offset, offset + limit);
  }

  async getLogsByController(controller: string, limit = 100): Promise<Log[]> {
    const logs = await this.readLogs();
    return logs
      .filter(l => l.controller === controller)
      .reverse()
      .slice(0, limit);
  }

  async getLogsByUser(userId: string, limit = 100): Promise<Log[]> {
    const logs = await this.readLogs();
    return logs
      .filter(l => l.user_id === userId)
      .reverse()
      .slice(0, limit);
  }

  async getLogsByTable(tableName: string, limit = 100): Promise<Log[]> {
    const logs = await this.readLogs();
    return logs
      .filter(l => l.table_name === tableName)
      .reverse()
      .slice(0, limit);
  }

  async deleteOldLogs(daysOld: number): Promise<void> {
    const logs = await this.readLogs();
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const filtered = logs.filter(l => new Date(l.timestamp).getTime() >= cutoff);
    await this.writeLogs(filtered);
  }

  async getLogStats(): Promise<{
    totalLogs: number;
    logsByController: { controller: string; count: number }[];
    logsByTable: { table_name: string; count: number }[];
  }> {
    const logs = await this.readLogs();
    const logsByController: Record<string, number> = {};
    const logsByTable: Record<string, number> = {};
    for (const log of logs) {
      logsByController[log.controller] = (logsByController[log.controller] || 0) + 1;
      if (log.table_name) logsByTable[log.table_name] = (logsByTable[log.table_name] || 0) + 1;
    }
    return {
      totalLogs: logs.length,
      logsByController: Object.entries(logsByController).map(([controller, count]) => ({ controller, count })),
      logsByTable: Object.entries(logsByTable).map(([table_name, count]) => ({ table_name, count })),
    };
  }
}
