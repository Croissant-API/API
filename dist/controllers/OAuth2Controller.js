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
exports.OAuth2 = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const describe_1 = require("../decorators/describe");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
let OAuth2 = class OAuth2 {
    constructor(oauth2Service) {
        this.oauth2Service = oauth2Service;
    }
    // --- Application Management ---
    async getAppByClientId(req, res) {
        try {
            const { client_id } = req.params;
            const app = await this.oauth2Service.getFormattedAppByClientId(client_id);
            if (!app)
                return res.status(404).send({ message: "App not found" });
            res.send(app);
        }
        catch (error) {
            handleError(res, error, "Error fetching app");
        }
    }
    async createApp(req, res) {
        try {
            const { name, redirect_urls } = req.body;
            if (!name || !redirect_urls || !Array.isArray(redirect_urls)) {
                return res.status(400).send({ message: "Invalid request body" });
            }
            const app = await this.oauth2Service.createApp(req.user.user_id, name, redirect_urls);
            res.status(201).send({
                client_id: app.client_id,
                client_secret: app.client_secret
            });
        }
        catch (error) {
            handleError(res, error, "Error creating app");
        }
    }
    async getMyApps(req, res) {
        try {
            const apps = await this.oauth2Service.getFormattedAppsByOwner(req.user.user_id);
            res.send(apps);
        }
        catch (error) {
            handleError(res, error, "Error fetching apps");
        }
    }
    async updateApp(req, res) {
        try {
            const { client_id } = req.params;
            const { name, redirect_urls } = req.body;
            const userId = req.user.user_id;
            await this.oauth2Service.updateApp(client_id, userId, {
                name,
                redirect_urls,
            });
            res.status(200).send({ success: true });
        }
        catch (error) {
            handleError(res, error, "Error updating app");
        }
    }
    async deleteApp(req, res) {
        try {
            const { client_id } = req.params;
            const userId = req.user.user_id;
            await this.oauth2Service.deleteApp(client_id, userId);
            res.status(204).send();
        }
        catch (error) {
            handleError(res, error, "Error deleting app");
        }
    }
    // --- Authorization & User ---
    async authorize(req, res) {
        try {
            const userId = req.user?.user_id;
            if (!userId) {
                return res.status(401).send({ message: "Unauthorized" });
            }
            const { client_id, redirect_uri } = req.query;
            if (!client_id || !redirect_uri) {
                return res.status(400).send({ message: "Missing client_id or redirect_uri" });
            }
            const code = await this.oauth2Service.generateAuthCode(client_id, redirect_uri, userId);
            res.send({ code });
        }
        catch (error) {
            handleError(res, error, "Error generating authorization code");
        }
    }
    async getUserByCode(req, res) {
        try {
            const { code, client_id } = req.query;
            if (!code || !client_id) {
                return res.status(400).send({ message: "Missing code or client_id" });
            }
            const user = await this.oauth2Service.getUserByCode(code, client_id);
            if (!user)
                return res.status(404).send({ message: "User not found" });
            res.send(user);
        }
        catch (error) {
            handleError(res, error, "Error fetching user");
        }
    }
};
__decorate([
    (0, describe_1.describe)({
        endpoint: "/oauth2/app/:client_id",
        method: "GET",
        description: "Get an OAuth2 app by client_id",
        params: { client_id: "The client_id of the app" },
        responseType: {
            client_id: "string",
            client_secret: "string",
            name: "string",
            redirect_urls: ["string"]
        },
        example: "GET /api/oauth2/app/123"
    }),
    (0, inversify_express_utils_1.httpGet)("/app/:client_id"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "getAppByClientId", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/oauth2/app",
        method: "POST",
        description: "Create a new OAuth2 app",
        body: {
            name: "Name of the app",
            redirect_urls: "Array of redirect URLs"
        },
        responseType: {
            client_id: "string",
            client_secret: "string"
        },
        example: 'POST /api/oauth2/app {"name": "My App", "redirect_urls": ["https://example.com/callback"]}',
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpPost)("/app", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "createApp", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/oauth2/apps",
        method: "GET",
        description: "Get all OAuth2 apps owned by the authenticated user",
        responseType: [{
                client_id: "string",
                client_secret: "string",
                name: "string",
                redirect_urls: ["string"]
            }],
        example: "GET /api/oauth2/apps",
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpGet)("/apps", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "getMyApps", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/oauth2/app/:client_id",
        method: "PATCH",
        description: "Update an OAuth2 app",
        params: { client_id: "The client_id of the app" },
        body: {
            name: "Name of the app (optional)",
            redirect_urls: "Array of redirect URLs (optional)"
        },
        responseType: { success: "boolean" },
        example: 'PATCH /api/oauth2/app/123 {"name": "Updated App"}',
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpPatch)("/app/:client_id", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "updateApp", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/oauth2/app/:client_id",
        method: "DELETE",
        description: "Delete an OAuth2 app",
        params: { client_id: "The client_id of the app" },
        responseType: { message: "string" },
        example: "DELETE /api/oauth2/app/123",
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpDelete)("/app/:client_id", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "deleteApp", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/oauth2/authorize",
        method: "GET",
        description: "Authorize a user for an OAuth2 app",
        query: {
            client_id: "The client_id of the app",
            redirect_uri: "The redirect URI"
        },
        responseType: { code: "string" },
        example: "GET /api/oauth2/authorize?client_id=123&redirect_uri=https://example.com/callback",
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpGet)("/authorize", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "authorize", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/oauth2/user",
        method: "GET",
        description: "Get user information by authorization code",
        query: {
            code: "The authorization code",
            client_id: "The client_id of the app"
        },
        responseType: {
            username: "string",
            user_id: "string",
            email: "string",
            balance: "number",
            verified: "boolean",
            steam_username: "string",
            steam_avatar_url: "string",
            steam_id: "string"
        },
        example: "GET /api/oauth2/user?code=abc123&client_id=456"
    }),
    (0, inversify_express_utils_1.httpGet)("/user"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "getUserByCode", null);
OAuth2 = __decorate([
    (0, inversify_express_utils_1.controller)("/oauth2"),
    __param(0, (0, inversify_1.inject)("OAuth2Service")),
    __metadata("design:paramtypes", [Object])
], OAuth2);
exports.OAuth2 = OAuth2;
