/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { controller, httpGet } from '../hono-inversify';
import { inject, injectable } from 'inversify';
let LogController = class LogController {
    constructor(logService) {
        this.logService = logService;
    }
    getUserFromContext(c) {
        return c.get('user');
    }
    sendError(c, status, message) {
        return c.json({ message }, status);
    }
    async getAllLogs(c) {
        const user = this.getUserFromContext(c);
        if (!user?.admin) {
            return this.sendError(c, 403, 'Admin access required');
        }
        try {
            const limit = parseInt(c.req.query('limit') || '100');
            const offset = parseInt(c.req.query('offset') || '0');
            const logs = await this.logService.getLogs(limit, offset);
            return c.json(logs);
        }
        catch (error) {
            return this.sendError(c, 500, 'Error fetching logs');
        }
    }
    async getLogsByController(c) {
        const user = this.getUserFromContext(c);
        if (!user?.admin) {
            return this.sendError(c, 403, 'Admin access required');
        }
        try {
            const controller = c.req.param('controller');
            const limit = parseInt(c.req.query('limit') || '100');
            const logs = await this.logService.getLogsByController(controller, limit);
            return c.json(logs);
        }
        catch (error) {
            return this.sendError(c, 500, 'Error fetching logs by controller');
        }
    }
    async getLogsByUser(c) {
        const user = this.getUserFromContext(c);
        if (!user?.admin) {
            return this.sendError(c, 403, 'Admin access required');
        }
        try {
            const userId = c.req.param('userId');
            const limit = parseInt(c.req.query('limit') || '100');
            const logs = await this.logService.getLogsByUser(userId, limit);
            return c.json(logs);
        }
        catch (error) {
            return this.sendError(c, 500, 'Error fetching logs by user');
        }
    }
    async getLogsByTable(c) {
        const user = this.getUserFromContext(c);
        if (!user?.admin) {
            return this.sendError(c, 403, 'Admin access required');
        }
        try {
            const tableName = c.req.param('tableName');
            const limit = parseInt(c.req.query('limit') || '100');
            const logs = await this.logService.getLogsByTable(tableName, limit);
            return c.json(logs);
        }
        catch (error) {
            return this.sendError(c, 500, 'Error fetching logs by table');
        }
    }
    async getLogStats(c) {
        const user = this.getUserFromContext(c);
        if (!user?.admin) {
            return this.sendError(c, 403, 'Admin access required');
        }
        try {
            const stats = await this.logService.getLogStats();
            return c.json(stats);
        }
        catch (error) {
            return this.sendError(c, 500, 'Error fetching log statistics');
        }
    }
    async getMyLogs(c) {
        const user = this.getUserFromContext(c);
        if (!user) {
            return this.sendError(c, 401, 'Unauthorized');
        }
        try {
            const limit = parseInt(c.req.query('limit') || '100');
            const logs = await this.logService.getLogsByUser(user.user_id, limit);
            return c.json(logs);
        }
        catch (error) {
            return this.sendError(c, 500, 'Error fetching user logs');
        }
    }
};
__decorate([
    httpGet('/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getAllLogs", null);
__decorate([
    httpGet('/controller/:controller'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getLogsByController", null);
__decorate([
    httpGet('/user/:userId'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getLogsByUser", null);
__decorate([
    httpGet('/table/:tableName'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getLogsByTable", null);
__decorate([
    httpGet('/stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getLogStats", null);
__decorate([
    httpGet('/@me'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getMyLogs", null);
LogController = __decorate([
    injectable(),
    controller('/logs'),
    __param(0, inject('LogService')),
    __metadata("design:paramtypes", [Object])
], LogController);
export { LogController };
