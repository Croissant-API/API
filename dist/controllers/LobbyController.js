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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lobbies = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const uuid_1 = require("uuid");
const yup_1 = require("yup");
const describe_1 = require("../decorators/describe");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const LobbyValidator_1 = require("../validators/LobbyValidator");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
async function validateOr400(schema, data, res) {
    try {
        await schema.validate(data);
        return true;
    }
    catch (error) {
        if (error instanceof yup_1.ValidationError) {
            res.status(400).send({ message: 'Validation failed', errors: error.errors });
            return false;
        }
        throw error;
    }
}
const createLobbyRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: 'Too many lobby creations, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const joinLobbyRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: 'Too many lobby joins, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const leaveLobbyRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: 'Too many lobby leaves, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
let Lobbies = class Lobbies {
    constructor(lobbyService, logService) {
        this.lobbyService = lobbyService;
        this.logService = logService;
    }
    async createLog(req, action, tableName, statusCode, userId) {
        try {
            await this.logService.createLog({
                ip_address: req.headers['x-real-ip'] || req.socket.remoteAddress,
                table_name: tableName,
                controller: `LobbyController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: req.body,
                user_id: userId,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    async createLobby(req, res) {
        try {
            const lobbyId = (0, uuid_1.v4)();
            await this.lobbyService.createLobby(lobbyId, [req.user.user_id]);
            await this.lobbyService.joinLobby(lobbyId, req.user.user_id);
            await this.createLog(req, 'createLobby', 'lobbies', 201, req.user.user_id);
            res.status(201).send({ message: 'Lobby created' });
        }
        catch (error) {
            await this.createLog(req, 'createLobby', 'lobbies', 500, req.user?.user_id);
            const message = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: 'Error creating lobby', error: message });
        }
    }
    async getLobby(req, res) {
        if (!(await validateOr400(LobbyValidator_1.lobbyIdParamSchema, req.params, res))) {
            await this.createLog(req, 'getLobby', 'lobbies', 400);
            return;
        }
        try {
            const lobbyId = req.params.lobbyId;
            const lobby = await this.lobbyService.getLobby(lobbyId);
            if (!lobby) {
                await this.createLog(req, 'getLobby', 'lobbies', 404);
                return res.status(404).send({ message: 'Lobby not found' });
            }
            await this.createLog(req, 'getLobby', 'lobbies', 200);
            res.send(lobby);
        }
        catch (error) {
            await this.createLog(req, 'getLobby', 'lobbies', 500);
            handleError(res, error, 'Error fetching lobby');
        }
    }
    async getMyLobby(req, res) {
        try {
            const userId = req.user.user_id;
            const lobby = await this.lobbyService.getUserLobby(userId);
            if (!lobby) {
                await this.createLog(req, 'getMyLobby', 'lobbies', 200, userId);
                return res.status(200).send({ success: false, message: 'User is not in any lobby' });
            }
            await this.createLog(req, 'getMyLobby', 'lobbies', 200, userId);
            res.send({ success: true, ...lobby });
        }
        catch (error) {
            await this.createLog(req, 'getMyLobby', 'lobbies', 500, req.user?.user_id);
            handleError(res, error, 'Error fetching user lobby');
        }
    }
    async getUserLobby(req, res) {
        if (!(await validateOr400(LobbyValidator_1.userIdParamSchema, req.params, res))) {
            await this.createLog(req, 'getUserLobby', 'lobbies', 400, req.params.userId);
            return;
        }
        try {
            const { userId } = req.params;
            const lobby = await this.lobbyService.getUserLobby(userId);
            if (!lobby) {
                await this.createLog(req, 'getUserLobby', 'lobbies', 404, userId);
                return res.status(404).send({ message: 'User is not in any lobby' });
            }
            await this.createLog(req, 'getUserLobby', 'lobbies', 200, userId);
            res.send(lobby);
        }
        catch (error) {
            await this.createLog(req, 'getUserLobby', 'lobbies', 500, req.params.userId);
            handleError(res, error, 'Error fetching user lobby');
        }
    }
    async joinLobby(req, res) {
        if (!(await validateOr400(LobbyValidator_1.lobbyIdParamSchema, req.params, res))) {
            await this.createLog(req, 'joinLobby', 'lobbies', 400, req.user.user_id);
            return;
        }
        try {
            await this.lobbyService.leaveAllLobbies(req.user.user_id);
            await this.lobbyService.joinLobby(req.params.lobbyId, req.user.user_id);
            await this.createLog(req, 'joinLobby', 'lobbies', 200, req.user.user_id);
            res.status(200).send({ message: 'Joined lobby' });
        }
        catch (error) {
            await this.createLog(req, 'joinLobby', 'lobbies', 500, req.user.user_id);
            handleError(res, error, 'Error joining lobby');
        }
    }
    async leaveLobby(req, res) {
        if (!(await validateOr400(LobbyValidator_1.lobbyIdParamSchema, req.params, res))) {
            await this.createLog(req, 'leaveLobby', 'lobbies', 400, req.user.user_id);
            return;
        }
        try {
            await this.lobbyService.leaveLobby(req.params.lobbyId, req.user.user_id);
            await this.createLog(req, 'leaveLobby', 'lobbies', 200, req.user.user_id);
            res.status(200).send({ message: 'Left lobby' });
        }
        catch (error) {
            await this.createLog(req, 'leaveLobby', 'lobbies', 500, req.user.user_id);
            handleError(res, error, 'Error leaving lobby');
        }
    }
};
exports.Lobbies = Lobbies;
__decorate([
    (0, describe_1.describe)({
        endpoint: '/lobbies',
        method: 'POST',
        description: 'Create a new lobby.',
        responseType: { message: 'string' },
        example: 'POST /api/lobbies',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)('/', LoggedCheck_1.LoggedCheck.middleware, createLobbyRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "createLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/lobbies/:lobbyId',
        method: 'GET',
        description: 'Get a lobby by lobbyId',
        params: { lobbyId: 'The id of the lobby' },
        responseType: {
            lobbyId: 'string',
            users: [
                {
                    username: 'string',
                    user_id: 'string',
                    verified: 'boolean',
                    steam_username: 'string',
                    steam_avatar_url: 'string',
                    steam_id: 'string',
                },
            ],
        },
        example: 'GET /api/lobbies/123',
    }),
    (0, inversify_express_utils_1.httpGet)('/:lobbyId'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "getLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/lobbies/user/@me',
        method: 'GET',
        description: 'Get the lobby the authenticated user is in.',
        responseType: { success: 'boolean', lobbyId: 'string', users: ['string'] },
        example: 'GET /api/lobbies/user/@me',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpGet)('/user/@me', LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "getMyLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/lobbies/user/:userId',
        method: 'GET',
        description: 'Get the lobby a user is in',
        params: { userId: 'The id of the user' },
        responseType: { lobbyId: 'string', users: ['string'] },
        example: 'GET /api/lobbies/user/123',
    }),
    (0, inversify_express_utils_1.httpGet)('/user/:userId'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "getUserLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/lobbies/:lobbyId/join',
        method: 'POST',
        description: 'Join a lobby. This will make the user leave all other lobbies first.',
        params: { lobbyId: 'The id of the lobby' },
        responseType: { message: 'string' },
        example: 'POST /api/lobbies/123/join',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)('/:lobbyId/join', LoggedCheck_1.LoggedCheck.middleware, joinLobbyRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "joinLobby", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/lobbies/:lobbyId/leave',
        method: 'POST',
        description: 'Leave a lobby.',
        params: { lobbyId: 'The id of the lobby' },
        responseType: { message: 'string' },
        example: 'POST /api/lobbies/123/leave',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)('/:lobbyId/leave', LoggedCheck_1.LoggedCheck.middleware, leaveLobbyRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Lobbies.prototype, "leaveLobby", null);
exports.Lobbies = Lobbies = __decorate([
    (0, inversify_express_utils_1.controller)('/lobbies'),
    __param(0, (0, inversify_1.inject)('LobbyService')),
    __param(1, (0, inversify_1.inject)('LogService')),
    __metadata("design:paramtypes", [Object, Object])
], Lobbies);
