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
let OAuth2 = class OAuth2 {
    constructor(oauth2Service) {
        this.oauth2Service = oauth2Service;
    }
    // --- Application Management ---
    async getAppByClientId(req, res) {
        const { client_id } = req.params;
        const app = await this.oauth2Service.getAppByClientId(client_id);
        if (!app)
            return res.status(404).send({ message: "App not found" });
        res.send({
            client_id: app.client_id,
            client_secret: app.client_secret,
            name: app.name,
            redirect_urls: JSON.parse(app.redirect_urls),
        });
    }
    async createApp(req, res) {
        const { name, redirect_urls } = req.body;
        const app = await this.oauth2Service.createApp(req.user.user_id, name, redirect_urls);
        res
            .status(201)
            .send({ client_id: app.client_id, client_secret: app.client_secret });
    }
    async getMyApps(req, res) {
        const apps = await this.oauth2Service.getAppsByOwner(req.user.user_id);
        res.send(apps.map((a) => ({
            client_id: a.client_id,
            client_secret: a.client_secret,
            name: a.name,
            redirect_urls: JSON.parse(a.redirect_urls),
        })));
    }
    async updateApp(req, res) {
        const { client_id } = req.params;
        const { name, redirect_urls } = req.body;
        const userId = req.user.user_id;
        await this.oauth2Service.updateApp(client_id, userId, {
            name,
            redirect_urls,
        });
        res.status(200).send({ success: true });
    }
    async deleteApp(req, res) {
        const { client_id } = req.params;
        const userId = req.user.user_id;
        await this.oauth2Service.deleteApp(client_id, userId);
        res.status(204).send();
    }
    // --- Authorization & User ---
    async authorize(req, res) {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const { client_id, redirect_uri } = req.query;
        if (!client_id || !redirect_uri || !userId)
            return res.status(400).send({ message: "Missing params" });
        const code = await this.oauth2Service.generateAuthCode(client_id, redirect_uri, userId);
        res.send({ code });
    }
    async getUserByCode(req, res) {
        const { code, client_id, client_secret } = req.query;
        if (!code || !client_id || !client_secret) {
            return res.status(400).send({ message: "Missing params" });
        }
        const user = await this.oauth2Service.getUserByCode(code, client_id, client_secret);
        if (!user)
            return res.status(404).send({ message: "User not found" });
        res.send(user);
    }
};
__decorate([
    (0, inversify_express_utils_1.httpGet)("/app/:client_id"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "getAppByClientId", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/app", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "createApp", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/apps", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "getMyApps", null);
__decorate([
    (0, inversify_express_utils_1.httpPatch)("/app/:client_id", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "updateApp", null);
__decorate([
    (0, inversify_express_utils_1.httpDelete)("/app/:client_id", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "deleteApp", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/authorize", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuth2.prototype, "authorize", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/oauth2/user",
        method: "GET",
        description: "Get user by code",
        query: {
            code: "string",
            client_id: "string",
            client_secret: "string",
            redirect_uri: "string",
        },
        responseType: { user: "object" },
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
