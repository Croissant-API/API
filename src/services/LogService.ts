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
  private readonly tableName = 'logs';

  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {}

  async createLog(logData: CreateLogData): Promise<void> {
    const knex = this.databaseService.getKnex();

    try {
      await knex(this.tableName).insert({
        timestamp: new Date().toISOString(),
        ip_address: logData.ip_address,
        table_name: logData.table_name || null,
        controller: logData.controller,
        original_path: logData.original_path,
        http_method: logData.http_method,
        request_body: logData.request_body ? JSON.stringify(logData.request_body) : null,
        user_id: logData.user_id || null,
        status_code: logData.status_code || null
      });
    } catch (error) {
      console.error("Error creating log:", error);
      throw error;
    }
  }

  async getLogs(limit = 100, offset = 0): Promise<Log[]> {
    const knex = this.databaseService.getKnex();

    try {
      return await knex(this.tableName)
        .select('*')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error("Error getting logs:", error);
      throw error;
    }
  }

  async getLogsByController(controller: string, limit = 100): Promise<Log[]> {
    const knex = this.databaseService.getKnex();

    try {
      return await knex(this.tableName)
        .select('*')
        .where({ controller: controller })
        .orderBy('timestamp', 'desc')
        .limit(limit);
    } catch (error) {
      console.error("Error getting logs by controller:", error);
      throw error;
    }
  }

  async getLogsByUser(userId: string, limit = 100): Promise<Log[]> {
    const knex = this.databaseService.getKnex();

    try {
      return await knex(this.tableName)
        .select('*')
        .where({ user_id: userId })
        .orderBy('timestamp', 'desc')
        .limit(limit);
    } catch (error) {
      console.error("Error getting logs by user:", error);
      throw error;
    }
  }

  async getLogsByTable(tableName: string, limit = 100): Promise<Log[]> {
    const knex = this.databaseService.getKnex();

    try {
      return await knex(this.tableName)
        .select('*')
        .where({ table_name: tableName })
        .orderBy('timestamp', 'desc')
        .limit(limit);
    } catch (error) {
      console.error("Error getting logs by table:", error);
      throw error;
    }
  }

  async deleteOldLogs(daysOld: number): Promise<void> {
    const knex = this.databaseService.getKnex();

    try {
      await knex(this.tableName)
        .where('timestamp', '<', knex.raw('datetime("now", ?)', [`-${daysOld} days`]))
        .delete();
    } catch (error) {
      console.error("Error deleting old logs:", error);
      throw error;
    }
  }

  async getLogStats(): Promise<{
    totalLogs: number;
    logsByController: { controller: string; count: number }[];
    logsByTable: { table_name: string; count: number }[];
  }> {
    const knex = this.databaseService.getKnex();

    try {
      const totalLogsResult = await knex(this.tableName)
        .count('* as count')
        .first();

      const logsByController = await knex(this.tableName)
        .select('controller')
        .count('* as count')
        .groupBy('controller')
        .orderBy('count', 'desc');

      const logsByTable = await knex(this.tableName)
        .select('table_name')
        .count('* as count')
        .whereNotNull('table_name')
        .groupBy('table_name')
        .orderBy('count', 'desc');

      return {
        totalLogs: Number(totalLogsResult?.count) || 0,
        logsByController: logsByController.map(item => ({ controller: String(item.controller), count: Number(item.count) })),
        logsByTable: logsByTable.map(item => ({ table_name: String(item.table_name), count: Number(item.count) }))
      };
    } catch (error) {
      console.error("Error getting log stats:", error);
      throw error;
    }
  }
}