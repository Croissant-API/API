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
exports.Studios = void 0;
const inversify_express_utils_1 = require("inversify-express-utils");
const inversify_1 = require("inversify");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const describe_1 = require("../decorators/describe");
let Studios = class Studios {
    constructor(studioService, logService) {
        this.studioService = studioService;
        this.logService = logService;
    }
    // Helper pour les logs (uniformisé)
    async createLog(req, tableName, statusCode, userId, metadata) {
        try {
            const requestBody = { ...req.body };
            if (metadata)
                requestBody.metadata = metadata;
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] || req.socket.remoteAddress,
                table_name: tableName,
                controller: "StudioController",
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: userId ?? req.user?.user_id,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error("Failed to log action:", error);
        }
    }
    // --- Création de studio ---
    async createStudio(req, res) {
        if (req.user.isStudio) {
            await this.createLog(req, "studios", 403);
            return res.status(403).send({ message: "A studio can't create another studio" });
        }
        const { studioName } = req.body;
        if (!studioName) {
            await this.createLog(req, "studios", 400);
            return res.status(400).send({ message: "Missing required fields" });
        }
        try {
            await this.studioService.createStudio(studioName, req.user.user_id);
            await this.createLog(req, "studios", 201);
            res.status(201).send({ message: "Studio created" });
        }
        catch (error) {
            await this.createLog(req, "studios", 500);
            handleError(res, error, "Error creating studio");
        }
    }
    // --- Récupération d'un studio ---
    async getStudio(req, res) {
        const { studioId } = req.params;
        try {
            const studio = await this.studioService.getStudio(studioId);
            if (!studio) {
                await this.createLog(req, "studios", 404);
                return res.status(404).send({ message: "Studio not found" });
            }
            await this.createLog(req, "studios", 200);
            res.send(studio);
        }
        catch (error) {
            await this.createLog(req, "studios", 500);
            handleError(res, error, "Error fetching studio");
        }
    }
    // --- Récupération des studios de l'utilisateur ---
    async getMyStudios(req, res) {
        try {
            const studios = await this.studioService.getUserStudios(req.user.user_id);
            await this.createLog(req, "studios", 200);
            res.send(studios);
        }
        catch (error) {
            await this.createLog(req, "studios", 500);
            handleError(res, error, "Error fetching user studios");
        }
    }
    // --- Gestion des membres ---
    async addUserToStudio(req, res) {
        const { studioId } = req.params;
        const { userId } = req.body;
        if (!userId) {
            await this.createLog(req, "studio_users", 400);
            return res.status(400).send({ message: "Missing userId" });
        }
        try {
            const user = await this.studioService.getUser(userId);
            if (!user) {
                await this.createLog(req, "studio_users", 404);
                return res.status(404).send({ message: "User not found" });
            }
            // Vérifier que l'utilisateur connecté est admin du studio
            const studio = await this.studioService.getStudio(studioId);
            if (!studio) {
                await this.createLog(req, "studio_users", 404);
                return res.status(404).send({ message: "Studio not found" });
            }
            if (studio.admin_id !== req.user.user_id) {
                await this.createLog(req, "studio_users", 403);
                return res.status(403).send({ message: "Only the studio admin can add users" });
            }
            await this.studioService.addUserToStudio(studioId, user);
            await this.createLog(req, "studio_users", 200);
            res.send({ message: "User added to studio" });
        }
        catch (error) {
            await this.createLog(req, "studio_users", 500);
            handleError(res, error, "Error adding user to studio");
        }
    }
    async removeUserFromStudio(req, res) {
        const { studioId } = req.params;
        const { userId } = req.body;
        if (!userId) {
            await this.createLog(req, "studio_users", 400);
            return res.status(400).send({ message: "Missing userId" });
        }
        try {
            const studio = await this.studioService.getStudio(studioId);
            if (!studio) {
                await this.createLog(req, "studio_users", 404);
                return res.status(404).send({ message: "Studio not found" });
            }
            if (studio.admin_id === userId) {
                await this.createLog(req, "studio_users", 403);
                return res.status(403).send({ message: "Cannot remove the studio admin" });
            }
            if (req.user.user_id !== studio.admin_id) {
                await this.createLog(req, "studio_users", 403);
                return res.status(403).send({ message: "Only the studio admin can remove users" });
            }
            await this.studioService.removeUserFromStudio(studioId, userId);
            await this.createLog(req, "studio_users", 200);
            res.send({ message: "User removed from studio" });
        }
        catch (error) {
            await this.createLog(req, "studio_users", 500);
            handleError(res, error, "Error removing user from studio");
        }
    }
};
exports.Studios = Studios;
__decorate([
    (0, describe_1.describe)({
        endpoint: "/studios",
        method: "POST",
        description: "Create a new studio.",
        body: { studioName: "Name of the studio" },
        responseType: { message: "string" },
        example: 'POST /api/studios {"studioName": "My Studio"}',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)("/", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "createStudio", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/studios/:studioId",
        method: "GET",
        description: "Get a studio by studioId",
        params: { studioId: "The ID of the studio to retrieve" },
        responseType: {
            user_id: "string",
            username: "string",
            verified: "boolean",
            admin_id: "string",
            users: [
                {
                    user_id: "string",
                    username: "string",
                    verified: "boolean",
                    admin: "boolean",
                },
            ],
        },
        example: "GET /api/studios/studio123",
    }),
    (0, inversify_express_utils_1.httpGet)("/:studioId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "getStudio", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/studios/user/@me",
        method: "GET",
        description: "Get all studios the authenticated user is part of.",
        responseType: [
            {
                user_id: "string",
                username: "string",
                verified: "boolean",
                admin_id: "string",
                isAdmin: "boolean",
                apiKey: "string",
                users: [
                    {
                        user_id: "string",
                        username: "string",
                        verified: "boolean",
                        admin: "boolean",
                    },
                ],
            },
        ],
        example: "GET /api/studios/user/@me",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpGet)("/user/@me", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "getMyStudios", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/studios/:studioId/add-user",
        method: "POST",
        description: "Add a user to a studio.",
        params: { studioId: "The ID of the studio" },
        body: { userId: "The ID of the user to add" },
        responseType: { message: "string" },
        example: 'POST /api/studios/studio123/add-user {"userId": "user456"}',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)("/:studioId/add-user", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "addUserToStudio", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/studios/:studioId/remove-user",
        method: "POST",
        description: "Remove a user from a studio.",
        params: { studioId: "The ID of the studio" },
        body: { userId: "The ID of the user to remove" },
        responseType: { message: "string" },
        example: 'POST /api/studios/studio123/remove-user {"userId": "user456"}',
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)("/:studioId/remove-user", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "removeUserFromStudio", null);
exports.Studios = Studios = __decorate([
    (0, inversify_express_utils_1.controller)("/studios"),
    __param(0, (0, inversify_1.inject)("StudioService")),
    __param(1, (0, inversify_1.inject)("LogService")),
    __metadata("design:paramtypes", [Object, Object])
], Studios);
// --- UTILS ---
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
