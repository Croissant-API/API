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
import { inject, injectable } from 'inversify';
import { LoggedCheck } from 'middlewares/LoggedCheck';
import { describe } from '../decorators/describe';
import { controller, httpGet, httpPost } from '../hono-inversify';
import { createRateLimit } from '../middlewares/hono/rateLimit';
const createStudioRateLimit = createRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many studio creations, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const addUserToStudioRateLimit = createRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many add user requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
const removeUserFromStudioRateLimit = createRateLimit({
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
    sendError(c, status, message, error) {
        const response = { message };
        if (error) {
            response.error = error;
        }
        return c.json(response, status);
    }
    async createLog(c, action, tableName, statusCode, userId, metadata, body) {
        try {
            let requestBody = body || { note: 'Body not provided for logging' };
            if (metadata) {
                requestBody = { ...requestBody, metadata };
            }
            const clientIP = c.req.header('cf-connecting-ip') ||
                c.req.header('x-forwarded-for') ||
                c.req.header('x-real-ip') ||
                'unknown';
            await this.logService.createLog({
                ip_address: clientIP,
                table_name: tableName,
                controller: `StudioController.${action}`,
                original_path: c.req.path,
                http_method: c.req.method,
                request_body: JSON.stringify(requestBody),
                user_id: userId,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    // Helper pour récupérer l'utilisateur authentifié depuis le context
    getUserFromContext(c) {
        return c.get('user');
    }
    async getStudioOrError(studioId, c, userId) {
        const studio = await this.studioService.getStudio(studioId);
        if (!studio) {
            await this.createLog(c, 'getStudioOrError', 'studios', 404, userId, { studio_id: studioId });
            return null;
        }
        return studio;
    }
    async createStudio(c) {
        try {
            const user = this.getUserFromContext(c);
            if (!user) {
                await this.createLog(c, 'createStudio', 'studios', 401);
                return this.sendError(c, 401, 'Unauthorized');
            }
            if (user.isStudio) {
                await this.createLog(c, 'createStudio', 'studios', 403, user.user_id, {
                    reason: 'studio_cannot_create_studio',
                });
                return this.sendError(c, 403, "A studio can't create another studio");
            }
            const body = await c.req.json();
            const { studioName } = body;
            if (!studioName) {
                await this.createLog(c, 'createStudio', 'studios', 400, user.user_id, undefined, body);
                return this.sendError(c, 400, 'Missing required fields');
            }
            await this.studioService.createStudio(studioName, user.user_id);
            await this.createLog(c, 'createStudio', 'studios', 201, user.user_id, {
                studio_name: studioName,
            }, body);
            return c.json({ message: 'Studio created' }, 201);
        }
        catch (error) {
            console.error('Error creating studio:', error);
            const user = this.getUserFromContext(c);
            const body = await c.req.json().catch(() => ({}));
            await this.createLog(c, 'createStudio', 'studios', 500, user?.user_id, {
                error: error instanceof Error ? error.message : String(error),
            }, body);
            return this.sendError(c, 500, 'Error creating studio', error instanceof Error ? error.message : String(error));
        }
    }
    async getStudio(c) {
        try {
            const { studioId } = c.req.param();
            const studio = await this.getStudioOrError(studioId, c);
            if (!studio) {
                return this.sendError(c, 404, 'Studio not found');
            }
            await this.createLog(c, 'getStudio', 'studios', 200, undefined, {
                studio_id: studioId,
                users_count: studio.users?.length || 0,
            });
            return c.json(studio, 200);
        }
        catch (error) {
            console.error('Error fetching studio:', error);
            const { studioId } = c.req.param();
            await this.createLog(c, 'getStudio', 'studios', 500, undefined, {
                studio_id: studioId,
                error: error instanceof Error ? error.message : String(error),
            });
            return this.sendError(c, 500, 'Error fetching studio', error instanceof Error ? error.message : String(error));
        }
    }
    async getMyStudios(c) {
        try {
            const user = this.getUserFromContext(c);
            if (!user) {
                await this.createLog(c, 'getMyStudios', 'studios', 401);
                return this.sendError(c, 401, 'Unauthorized');
            }
            const studios = await this.studioService.getUserStudios(user.user_id);
            await this.createLog(c, 'getMyStudios', 'studios', 200, user.user_id, {
                studios_count: studios.length,
                user_studios: studios.map(s => ({ id: s.user_id, isAdmin: s.isAdmin })),
            });
            return c.json(studios, 200);
        }
        catch (error) {
            console.error('Error fetching user studios:', error);
            const user = this.getUserFromContext(c);
            await this.createLog(c, 'getMyStudios', 'studios', 500, user?.user_id, {
                error: error instanceof Error ? error.message : String(error),
            });
            return this.sendError(c, 500, 'Error fetching user studios', error instanceof Error ? error.message : String(error));
        }
    }
    async checkStudioAdmin(c, user, studioId) {
        const studio = await this.getStudioOrError(studioId, c, user.user_id);
        if (!studio)
            return null;
        if (studio.admin_id !== user.user_id) {
            await this.createLog(c, 'checkStudioAdmin', 'studio_users', 403, user.user_id, {
                studio_id: studioId,
                reason: 'not_admin',
                studio_admin_id: studio.admin_id,
            });
            return null;
        }
        return studio;
    }
    async addUserToStudio(c) {
        try {
            const user = this.getUserFromContext(c);
            if (!user) {
                await this.createLog(c, 'addUserToStudio', 'studio_users', 401);
                return this.sendError(c, 401, 'Unauthorized');
            }
            const { studioId } = c.req.param();
            const body = await c.req.json();
            const { userId } = body;
            if (!userId) {
                await this.createLog(c, 'addUserToStudio', 'studio_users', 400, user.user_id, {
                    studio_id: studioId,
                    reason: 'missing_user_id',
                }, body);
                return this.sendError(c, 400, 'Missing userId');
            }
            const targetUser = await this.studioService.getUser(userId);
            if (!targetUser) {
                await this.createLog(c, 'addUserToStudio', 'studio_users', 404, user.user_id, {
                    studio_id: studioId,
                    target_user_id: userId,
                    reason: 'user_not_found',
                }, body);
                return this.sendError(c, 404, 'User not found');
            }
            const studio = await this.checkStudioAdmin(c, user, studioId);
            if (!studio) {
                return this.sendError(c, 403, 'Only the studio admin can modify users');
            }
            await this.studioService.addUserToStudio(studioId, targetUser);
            await this.createLog(c, 'addUserToStudio', 'studio_users', 200, user.user_id, {
                studio_id: studioId,
                target_user_id: userId,
                target_username: targetUser.username,
            }, body);
            return c.json({ message: 'User added to studio' }, 200);
        }
        catch (error) {
            console.error('Error adding user to studio:', error);
            const user = this.getUserFromContext(c);
            const { studioId } = c.req.param();
            const body = await c.req.json().catch(() => ({}));
            await this.createLog(c, 'addUserToStudio', 'studio_users', 500, user?.user_id, {
                studio_id: studioId,
                error: error instanceof Error ? error.message : String(error),
            }, body);
            return this.sendError(c, 500, 'Error adding user to studio', error instanceof Error ? error.message : String(error));
        }
    }
    async removeUserFromStudio(c) {
        try {
            const user = this.getUserFromContext(c);
            if (!user) {
                await this.createLog(c, 'removeUserFromStudio', 'studio_users', 401);
                return this.sendError(c, 401, 'Unauthorized');
            }
            const { studioId } = c.req.param();
            const body = await c.req.json();
            const { userId } = body;
            if (!userId) {
                await this.createLog(c, 'removeUserFromStudio', 'studio_users', 400, user.user_id, {
                    studio_id: studioId,
                    reason: 'missing_user_id',
                }, body);
                return this.sendError(c, 400, 'Missing userId');
            }
            const studio = await this.checkStudioAdmin(c, user, studioId);
            if (!studio) {
                return this.sendError(c, 403, 'Only the studio admin can modify users');
            }
            if (studio.admin_id === userId) {
                await this.createLog(c, 'removeUserFromStudio', 'studio_users', 403, user.user_id, {
                    studio_id: studioId,
                    target_user_id: userId,
                    reason: 'cannot_remove_admin',
                }, body);
                return this.sendError(c, 403, 'Cannot remove the studio admin');
            }
            await this.studioService.removeUserFromStudio(studioId, userId);
            await this.createLog(c, 'removeUserFromStudio', 'studio_users', 200, user.user_id, {
                studio_id: studioId,
                target_user_id: userId,
            }, body);
            return c.json({ message: 'User removed from studio' }, 200);
        }
        catch (error) {
            console.error('Error removing user from studio:', error);
            const user = this.getUserFromContext(c);
            const { studioId } = c.req.param();
            const body = await c.req.json().catch(() => ({}));
            await this.createLog(c, 'removeUserFromStudio', 'studio_users', 500, user?.user_id, {
                studio_id: studioId,
                error: error instanceof Error ? error.message : String(error),
            }, body);
            return this.sendError(c, 500, 'Error removing user from studio', error instanceof Error ? error.message : String(error));
        }
    }
};
__decorate([
    describe({
        endpoint: '/studios',
        method: 'POST',
        description: 'Create a new studio.',
        body: { studioName: 'Name of the studio' },
        responseType: { message: 'string' },
        example: 'POST /api/studios {"studioName": "My Studio"}',
        requiresAuth: true,
    }),
    httpPost('/', LoggedCheck, createStudioRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "createStudio", null);
__decorate([
    describe({
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
    httpGet('/:studioId'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "getStudio", null);
__decorate([
    describe({
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
    httpGet('/user/@me'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "getMyStudios", null);
__decorate([
    describe({
        endpoint: '/studios/:studioId/add-user',
        method: 'POST',
        description: 'Add a user to a studio.',
        params: { studioId: 'The ID of the studio' },
        body: { userId: 'The ID of the user to add' },
        responseType: { message: 'string' },
        example: 'POST /api/studios/studio123/add-user {"userId": "user456"}',
        requiresAuth: true,
    }),
    httpPost('/:studioId/add-user', LoggedCheck, addUserToStudioRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "addUserToStudio", null);
__decorate([
    describe({
        endpoint: '/studios/:studioId/remove-user',
        method: 'POST',
        description: 'Remove a user from a studio.',
        params: { studioId: 'The ID of the studio' },
        body: { userId: 'The ID of the user to remove' },
        responseType: { message: 'string' },
        example: 'POST /api/studios/studio123/remove-user {"userId": "user456"}',
        requiresAuth: true,
    }),
    httpPost('/:studioId/remove-user', LoggedCheck, removeUserFromStudioRateLimit),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "removeUserFromStudio", null);
Studios = __decorate([
    injectable(),
    controller('/studios'),
    __param(0, inject('StudioService')),
    __param(1, inject('LogService')),
    __metadata("design:paramtypes", [Object, Object])
], Studios);
export { Studios };
