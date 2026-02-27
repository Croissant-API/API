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
        logsByController: {
            controller: string;
            count: number;
        }[];
        logsByTable: {
            table_name: string;
            count: number;
        }[];
    }>;
    /**
     * Prepare service for use.  An optional environment object can be
     * provided and will be forwarded to the database service initialization.
     */
    initialize(env?: any): Promise<void>;
}
export declare class LogService implements ILogService {
    private databaseService;
    private isInitialized;
    constructor(databaseService: IDatabaseService);
    initialize(env?: any): Promise<void>;
    private ensureInitialized;
    private ensureTableExists;
    createLog(logData: CreateLogData): Promise<void>;
    getLogs(limit?: number, offset?: number): Promise<Log[]>;
    getLogsByController(controller: string, limit?: number): Promise<Log[]>;
    getLogsByUser(userId: string, limit?: number): Promise<Log[]>;
    getLogsByTable(tableName: string, limit?: number): Promise<Log[]>;
    deleteOldLogs(daysOld: number): Promise<void>;
    getLogStats(): Promise<{
        totalLogs: number;
        logsByController: {
            controller: string;
            count: number;
        }[];
        logsByTable: {
            table_name: string;
            count: number;
        }[];
    }>;
}
