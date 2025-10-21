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
exports.LogController = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
let LogController = class LogController {
    constructor(logService) {
        this.logService = logService;
    }
    async getAllLogs(req, res) {
        if (!req.user?.admin) {
            return res.status(403).send({ message: 'Admin access required' });
        }
        try {
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;
            const logs = await this.logService.getLogs(limit, offset);
            res.send(logs);
        }
        catch (error) {
            handleError(res, error, 'Error fetching logs');
        }
    }
    async getLogsByController(req, res) {
        if (!req.user?.admin) {
            return res.status(403).send({ message: 'Admin access required' });
        }
        try {
            const controller = req.params.controller;
            const limit = parseInt(req.query.limit) || 100;
            const logs = await this.logService.getLogsByController(controller, limit);
            res.send(logs);
        }
        catch (error) {
            handleError(res, error, 'Error fetching logs by controller');
        }
    }
    async getLogsByUser(req, res) {
        if (!req.user?.admin) {
            return res.status(403).send({ message: 'Admin access required' });
        }
        try {
            const userId = req.params.userId;
            const limit = parseInt(req.query.limit) || 100;
            const logs = await this.logService.getLogsByUser(userId, limit);
            res.send(logs);
        }
        catch (error) {
            handleError(res, error, 'Error fetching logs by user');
        }
    }
    async getLogsByTable(req, res) {
        if (!req.user?.admin) {
            return res.status(403).send({ message: 'Admin access required' });
        }
        try {
            const tableName = req.params.tableName;
            const limit = parseInt(req.query.limit) || 100;
            const logs = await this.logService.getLogsByTable(tableName, limit);
            res.send(logs);
        }
        catch (error) {
            handleError(res, error, 'Error fetching logs by table');
        }
    }
    async getLogStats(req, res) {
        if (!req.user?.admin) {
            return res.status(403).send({ message: 'Admin access required' });
        }
        try {
            const stats = await this.logService.getLogStats();
            res.send(stats);
        }
        catch (error) {
            handleError(res, error, 'Error fetching log statistics');
        }
    }
    async getMyLogs(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const logs = await this.logService.getLogsByUser(req.user.user_id, limit);
            res.send(logs);
        }
        catch (error) {
            handleError(res, error, 'Error fetching user logs');
        }
    }
};
exports.LogController = LogController;
__decorate([
    (0, inversify_express_utils_1.httpGet)('/', LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getAllLogs", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)('/controller/:controller', LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getLogsByController", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)('/user/:userId', LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getLogsByUser", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)('/table/:tableName', LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getLogsByTable", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)('/stats', LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getLogStats", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)('/@me', LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LogController.prototype, "getMyLogs", null);
exports.LogController = LogController = __decorate([
    (0, inversify_express_utils_1.controller)('/logs'),
    __param(0, (0, inversify_1.inject)('LogService')),
    __metadata("design:paramtypes", [Object])
], LogController);
