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
const GenKey_1 = require("../utils/GenKey");
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
let OAuth2 = class OAuth2 {
    constructor(oauth2Service, logService) {
        this.oauth2Service = oauth2Service;
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
                controller: 'OAuth2Controller',
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: userId ?? req.user?.user_id,
                status_code: statusCode
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    // --- Application Management ---
    async getAppByClientId(req, res) {
        const { client_id } = req.params;
        try {
            const app = await this.oauth2Service.getFormattedAppByClientId(client_id);
            if (!app) {
                await this.createLog(req, 'oauth2_apps', 404, undefined, { client_id });
                return res.status(404).send({ message: "App not found" });
            }
            await this.createLog(req, 'oauth2_apps', 200, undefined, { client_id, app_name: app.name });
            res.send(app);
        }
        catch (error) {
            await this.createLog(req, 'oauth2_apps', 500, undefined, {
                client_id,
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error fetching app");
        }
    }
    async createApp(req, res) {
        const { name, redirect_urls } = req.body;
        if (!name || !redirect_urls || !Array.isArray(redirect_urls)) {
            await this.createLog(req, 'oauth2_apps', 400, req.user.user_id, { reason: 'invalid_request_body' });
            return res.status(400).send({ message: "Invalid request body" });
        }
        try {
            const app = await this.oauth2Service.createApp(req.user.user_id, name, redirect_urls);
            await this.createLog(req, 'oauth2_apps', 201, req.user.user_id, {
                app_name: name,
                client_id: app.client_id,
                redirect_urls_count: redirect_urls.length
            });
            res.status(201).send({
                client_id: app.client_id,
                client_secret: app.client_secret
            });
        }
        catch (error) {
            await this.createLog(req, 'oauth2_apps', 500, req.user.user_id, {
                app_name: name,
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error creating app");
        }
    }
    async getMyApps(req, res) {
        try {
            const apps = await this.oauth2Service.getFormattedAppsByOwner(req.user.user_id);
            await this.createLog(req, 'oauth2_apps', 200, req.user.user_id, { apps_count: apps.length });
            res.send(apps);
        }
        catch (error) {
            await this.createLog(req, 'oauth2_apps', 500, req.user.user_id, {
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error fetching apps");
        }
    }
    async updateApp(req, res) {
        const { client_id } = req.params;
        const { name, redirect_urls } = req.body;
        try {
            await this.oauth2Service.updateApp(client_id, req.user.user_id, {
                name,
                redirect_urls,
            });
            await this.createLog(req, 'oauth2_apps', 200, req.user.user_id, {
                client_id,
                updated_fields: {
                    name: name ? true : false,
                    redirect_urls: redirect_urls ? true : false
                }
            });
            res.status(200).send({ success: true });
        }
        catch (error) {
            await this.createLog(req, 'oauth2_apps', 500, req.user.user_id, {
                client_id,
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error updating app");
        }
    }
    async deleteApp(req, res) {
        const { client_id } = req.params;
        try {
            await this.oauth2Service.deleteApp(client_id, req.user.user_id);
            await this.createLog(req, 'oauth2_apps', 204, req.user.user_id, { client_id });
            res.status(204).send();
        }
        catch (error) {
            await this.createLog(req, 'oauth2_apps', 500, req.user.user_id, {
                client_id,
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error deleting app");
        }
    }
    // --- Authorization & User ---
    async authorize(req, res) {
        const { client_id, redirect_uri } = req.query;
        const userId = req.user?.user_id;
        if (!userId) {
            await this.createLog(req, 'oauth2_authorizations', 401, undefined, { reason: 'no_user_id' });
            return res.status(401).send({ message: "Unauthorized" });
        }
        if (!client_id || !redirect_uri) {
            await this.createLog(req, 'oauth2_authorizations', 400, userId, {
                reason: 'missing_parameters',
                has_client_id: !!client_id,
                has_redirect_uri: !!redirect_uri
            });
            return res.status(400).send({ message: "Missing client_id or redirect_uri" });
        }
        try {
            const code = await this.oauth2Service.generateAuthCode(client_id, redirect_uri, userId);
            await this.createLog(req, 'oauth2_authorizations', 200, userId, {
                client_id,
                redirect_uri,
                code_generated: true
            });
            res.send({ code });
        }
        catch (error) {
            await this.createLog(req, 'oauth2_authorizations', 500, userId, {
                client_id,
                redirect_uri,
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error generating authorization code");
        }
    }
    async getUserByCode(req, res) {
        const { code, client_id } = req.query;
        if (!code || !client_id) {
            await this.createLog(req, 'oauth2_user_access', 400, undefined, {
                reason: 'missing_parameters',
                has_code: !!code,
                has_client_id: !!client_id
            });
            return res.status(400).send({ message: "Missing code or client_id" });
        }
        try {
            const user = await this.oauth2Service.getUserByCode(code, client_id);
            if (!user) {
                await this.createLog(req, 'oauth2_user_access', 404, undefined, {
                    client_id,
                    code_provided: true
                });
                return res.status(404).send({ message: "User not found" });
            }
            await this.createLog(req, 'oauth2_user_access', 200, user.user_id, {
                client_id,
                user_id: user.user_id,
                username: user.username
            });
            res.send({ ...user, verificationKey: (0, GenKey_1.genVerificationKey)(user.user_id) });
        }
        catch (error) {
            await this.createLog(req, 'oauth2_user_access', 500, undefined, {
                client_id,
                error: error instanceof Error ? error.message : String(error)
            });
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
            steam_id: "string",
            discord_id: "string",
            google_id: "string",
            verificationKey: "string"
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
    __param(1, (0, inversify_1.inject)("LogService")),
    __metadata("design:paramtypes", [Object, Object])
], OAuth2);
exports.OAuth2 = OAuth2;
