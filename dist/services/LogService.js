"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogService = void 0;
const inversify_1 = require("inversify");
let LogService = class LogService {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async createLog(logData) {
        return;
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
    async getLogs(limit = 100, offset = 0) {
        const query = `
      SELECT * FROM logs 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
        return await this.databaseService.read(query, [limit, offset]);
    }
    async getLogsByController(controller, limit = 100) {
        const query = `
      SELECT * FROM logs 
      WHERE controller = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
        return await this.databaseService.read(query, [controller, limit]);
    }
    async getLogsByUser(userId, limit = 100) {
        const query = `
      SELECT * FROM logs 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
        return await this.databaseService.read(query, [userId, limit]);
    }
    async getLogsByTable(tableName, limit = 100) {
        const query = `
      SELECT * FROM logs 
      WHERE table_name = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
        return await this.databaseService.read(query, [tableName, limit]);
    }
    async deleteOldLogs(daysOld) {
        const query = `
      DELETE FROM logs 
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `;
        await this.databaseService.request(query, [daysOld]);
    }
    // Méthodes utilitaires pour les statistiques
    async getLogStats() {
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
            this.databaseService.read(totalQuery),
            this.databaseService.read(controllerQuery),
            this.databaseService.read(tableQuery)
        ]);
        return {
            totalLogs: totalResult[0]?.count || 0,
            logsByController: controllerStats,
            logsByTable: tableStats
        };
    }
};
exports.LogService = LogService;
exports.LogService = LogService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], LogService);
