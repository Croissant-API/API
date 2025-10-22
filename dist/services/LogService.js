"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogService = void 0;
const sync_1 = require("csv-parse/sync");
const fs = __importStar(require("fs/promises"));
const inversify_1 = require("inversify");
const path = __importStar(require("path"));
const LOG_FILE = path.join(__dirname, '../../logs.csv');
let LogService = class LogService {
    async ensureFileExists() {
        try {
            await fs.access(LOG_FILE);
        }
        catch {
            const header = 'timestamp,ip_address,table_name,controller,original_path,http_method,request_body,user_id,status_code\n';
            await fs.writeFile(LOG_FILE, header, 'utf8');
        }
    }
    async readLogs() {
        await this.ensureFileExists();
        const content = await fs.readFile(LOG_FILE, 'utf8');
        const records = (0, sync_1.parse)(content, {
            columns: true,
            skip_empty_lines: true,
        });
        return records;
    }
    async writeLogs(logs) {
        const header = 'timestamp,ip_address,table_name,controller,original_path,http_method,request_body,user_id,status_code\n';
        const lines = logs.map(log => [log.timestamp, log.ip_address, log.table_name ?? '', log.controller, log.original_path, log.http_method, log.request_body ? JSON.stringify(log.request_body) : '', log.user_id ?? '', log.status_code ?? ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        await fs.writeFile(LOG_FILE, header + lines.join('\n'), 'utf8');
    }
    async createLog(logData) {
        await this.ensureFileExists();
        const log = {
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
    async getLogs(limit = 100, offset = 0) {
        const logs = await this.readLogs();
        return logs.reverse().slice(offset, offset + limit);
    }
    async getLogsByController(controller, limit = 100) {
        const logs = await this.readLogs();
        return logs
            .filter(l => l.controller === controller)
            .reverse()
            .slice(0, limit);
    }
    async getLogsByUser(userId, limit = 100) {
        const logs = await this.readLogs();
        return logs
            .filter(l => l.user_id === userId)
            .reverse()
            .slice(0, limit);
    }
    async getLogsByTable(tableName, limit = 100) {
        const logs = await this.readLogs();
        return logs
            .filter(l => l.table_name === tableName)
            .reverse()
            .slice(0, limit);
    }
    async deleteOldLogs(daysOld) {
        const logs = await this.readLogs();
        const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
        const filtered = logs.filter(l => new Date(l.timestamp).getTime() >= cutoff);
        await this.writeLogs(filtered);
    }
    async getLogStats() {
        const logs = await this.readLogs();
        const logsByController = {};
        const logsByTable = {};
        for (const log of logs) {
            logsByController[log.controller] = (logsByController[log.controller] || 0) + 1;
            if (log.table_name)
                logsByTable[log.table_name] = (logsByTable[log.table_name] || 0) + 1;
        }
        return {
            totalLogs: logs.length,
            logsByController: Object.entries(logsByController).map(([controller, count]) => ({ controller, count })),
            logsByTable: Object.entries(logsByTable).map(([table_name, count]) => ({ table_name, count })),
        };
    }
};
exports.LogService = LogService;
exports.LogService = LogService = __decorate([
    (0, inversify_1.injectable)()
], LogService);
