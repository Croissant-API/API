"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Studios = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const describe_1 = require("../decorators/describe");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const createStudioRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many studio creations, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const addUserToStudioRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many add user requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const removeUserFromStudioRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many remove user requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
let Studios = class Studios {
    constructor(studioService, logService) {
        this.studioService = studioService;
        this.logService = logService;
    }
    async createLog(req, tableName, statusCode, userId, metadata) {
        try {
            const requestBody = { ...req.body, ...(metadata && { metadata }) };
            await this.logService.createLog({
                ip_address: req.headers['x-real-ip'] || req.socket.remoteAddress,
                table_name: tableName,
                controller: 'StudioController',
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: userId ?? req.user?.user_id,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    async handleError(res, req, table, status, error, msg) {
        await this.createLog(req, table, status);
        res.status(status).send({ message: msg, error: error instanceof Error ? error.message : String(error) });
    }
    async getStudioOrError(studioId, req, res) {
        const studio = await this.studioService.getStudio(studioId);
        if (!studio) {
            await this.createLog(req, 'studios', 404);
            res.status(404).send({ message: 'Studio not found' });
            return null;
        }
        return studio;
    }
    async createStudio(req, res) {
        if (req.user.isStudio)
            return res.status(403).send({ message: "A studio can't create another studio" });
        const { studioName } = req.body;
        if (!studioName)
            return res.status(400).send({ message: 'Missing required fields' });
        try {
            await this.studioService.createStudio(studioName, req.user.user_id);
            await this.createLog(req, 'studios', 201);
            res.status(201).send({ message: 'Studio created' });
        }
        catch (error) {
            await this.handleError(res, req, 'studios', 500, error, 'Error creating studio');
        }
    }
    async getStudio(req, res) {
        try {
            const studio = await this.getStudioOrError(req.params.studioId, req, res);
            if (!studio)
                return;
            await this.createLog(req, 'studios', 200);
            res.send(studio);
        }
        catch (error) {
            await this.handleError(res, req, 'studios', 500, error, 'Error fetching studio');
        }
    }
    async getMyStudios(req, res) {
        try {
            const studios = await this.studioService.getUserStudios(req.user.user_id);
            await this.createLog(req, 'studios', 200);
            res.send(studios);
        }
        catch (error) {
            await this.handleError(res, req, 'studios', 500, error, 'Error fetching user studios');
        }
    }
    async checkStudioAdmin(req, res, studioId) {
        const studio = await this.getStudioOrError(studioId, req, res);
        if (!studio)
            return null;
        if (studio.admin_id !== req.user.user_id) {
            await this.createLog(req, 'studio_users', 403);
            res.status(403).send({ message: 'Only the studio admin can modify users' });
            return null;
        }
        return studio;
    }
    async addUserToStudio(req, res) {
        const { studioId } = req.params;
        const { userId } = req.body;
        if (!userId)
            return res.status(400).send({ message: 'Missing userId' });
        try {
            const user = await this.studioService.getUser(userId);
            if (!user)
                return res.status(404).send({ message: 'User not found' });
            const studio = await this.checkStudioAdmin(req, res, studioId);
            if (!studio)
                return;
            await this.studioService.addUserToStudio(studioId, user);
            await this.createLog(req, 'studio_users', 200);
            res.send({ message: 'User added to studio' });
        }
        catch (error) {
            await this.handleError(res, req, 'studio_users', 500, error, 'Error adding user to studio');
        }
    }
    async removeUserFromStudio(req, res) {
        const { studioId } = req.params;
        const { userId } = req.body;
        if (!userId)
            return res.status(400).send({ message: 'Missing userId' });
        try {
            const studio = await this.checkStudioAdmin(req, res, studioId);
            if (!studio)
                return;
            if (studio.admin_id === userId)
                return res.status(403).send({ message: 'Cannot remove the studio admin' });
            await this.studioService.removeUserFromStudio(studioId, userId);
            await this.createLog(req, 'studio_users', 200);
            res.send({ message: 'User removed from studio' });
        }
        catch (error) {
            await this.handleError(res, req, 'studio_users', 500, error, 'Error removing user from studio');
        }
    }
};
exports.Studios = Studios;
__decorate([
    (0, describe_1.describe)({
        endpoint: '/studios',
        method: 'POST',
        description: 'Create a new studio.',
        body: { studioName: 'Name of the studio' },
        responseType: { message: 'string' },
        example: 'POST /api/studios {"studioName": "My Studio"}',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)('/', LoggedCheck_1.LoggedCheck.middleware, createStudioRateLimit)
], Studios.prototype, "createStudio", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/studios/:studioId',
        method: 'GET',
        description: 'Get a studio by studioId',
        params: { studioId: 'The ID of the studio to retrieve' },
        responseType: {
            user_id: 'string',
            username: 'string',
            verified: 'boolean',
            admin_id: 'string',
            users: [
                {
                    user_id: 'string',
                    username: 'string',
                    verified: 'boolean',
                    admin: 'boolean',
                },
            ],
        },
        example: 'GET /api/studios/studio123',
    }),
    (0, inversify_express_utils_1.httpGet)('/:studioId')
], Studios.prototype, "getStudio", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/studios/user/@me',
        method: 'GET',
        description: 'Get all studios the authenticated user is part of.',
        responseType: [
            {
                user_id: 'string',
                username: 'string',
                verified: 'boolean',
                admin_id: 'string',
                isAdmin: 'boolean',
                apiKey: 'string',
                users: [
                    {
                        user_id: 'string',
                        username: 'string',
                        verified: 'boolean',
                        admin: 'boolean',
                    },
                ],
            },
        ],
        example: 'GET /api/studios/user/@me',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpGet)('/user/@me', LoggedCheck_1.LoggedCheck.middleware)
], Studios.prototype, "getMyStudios", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/studios/:studioId/add-user',
        method: 'POST',
        description: 'Add a user to a studio.',
        params: { studioId: 'The ID of the studio' },
        body: { userId: 'The ID of the user to add' },
        responseType: { message: 'string' },
        example: 'POST /api/studios/studio123/add-user {"userId": "user456"}',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)('/:studioId/add-user', LoggedCheck_1.LoggedCheck.middleware, addUserToStudioRateLimit)
], Studios.prototype, "addUserToStudio", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: '/studios/:studioId/remove-user',
        method: 'POST',
        description: 'Remove a user from a studio.',
        params: { studioId: 'The ID of the studio' },
        body: { userId: 'The ID of the user to remove' },
        responseType: { message: 'string' },
        example: 'POST /api/studios/studio123/remove-user {"userId": "user456"}',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)('/:studioId/remove-user', LoggedCheck_1.LoggedCheck.middleware, removeUserFromStudioRateLimit)
], Studios.prototype, "removeUserFromStudio", null);
exports.Studios = Studios = __decorate([
    (0, inversify_express_utils_1.controller)('/studios'),
    __param(0, (0, inversify_1.inject)('StudioService')),
    __param(1, (0, inversify_1.inject)('LogService'))
], Studios);
