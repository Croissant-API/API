import { CreateLogData, Log } from "../interfaces/Log";
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
}
export declare class LogService implements ILogService {
    private ensureFileExists;
    private readLogs;
    private writeLogs;
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

