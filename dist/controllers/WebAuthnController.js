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
exports.WebAuthn = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
const inversify_express_utils_1 = require("inversify-express-utils");
const inversify_1 = require("inversify");
const webauthnService_1 = require("../lib/webauthnService");
const GenKey_1 = require("../utils/GenKey");
let WebAuthn = class WebAuthn {
    constructor(userService, logService // Injection LogService
    ) {
        this.userService = userService;
        this.logService = logService;
    }
    // Helper pour créer des logs (uniformisé)
    async createLog(req, action, tableName, statusCode, userId, metadata) {
        try {
            const requestBody = { ...req.body };
            if (metadata)
                requestBody.metadata = metadata;
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] || req.socket.remoteAddress,
                table_name: tableName,
                controller: `WebAuthnController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: userId,
                status_code: statusCode
            });
        }
        catch (error) {
            // Ne jamais bloquer la route sur une erreur de log
            console.error('Error creating log:', error);
        }
    }
    async getRegistrationOptions(req, res) {
        const userId = req.body.userId;
        if (!userId) {
            await this.createLog(req, 'getRegistrationOptions', 'users', 400);
            return res.status(400).json({ message: "User ID is required" });
        }
        try {
            const options = await (0, webauthnService_1.getRegistrationOptions)(userId);
            // Encode challenge en base64 pour le front
            const challengeBase64 = Buffer.from(options.challenge).toString('base64');
            await this.userService.updateWebauthnChallenge(userId, challengeBase64); // <-- stocke en base64
            options.challenge = challengeBase64;
            options.user.id = Buffer.from(options.user.id).toString('base64');
            await this.createLog(req, 'getRegistrationOptions', 'users', 200, userId);
            res.status(200).json(options);
        }
        catch (error) {
            await this.createLog(req, 'getRegistrationOptions', 'users', 500, userId);
            res.status(500).json({ message: "Error generating registration options" });
        }
    }
    async verifyRegistration(req, res) {
        const { credential, userId } = req.body;
        if (!credential) {
            await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
            return res.status(400).json({ message: "Credential is required" });
        }
        try {
            const user = await this.userService.getUser(userId);
            const expectedChallenge = user?.webauthn_challenge;
            if (!expectedChallenge) {
                await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
                return res.status(400).json({ message: "No challenge found" });
            }
            // Si tu stockes en base64, il faut le convertir en base64url si le front utilise base64url
            function base64ToBase64url(str) {
                return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            }
            const expectedChallengeBase64url = base64ToBase64url(expectedChallenge);
            const verification = await (0, webauthnService_1.verifyRegistration)({ credential }, expectedChallengeBase64url);
            if (verification) {
                await this.userService.updateWebauthnChallenge(credential.id, null);
                await this.userService.addWebauthnCredential(userId, {
                    id: credential.id,
                    name: credential.name || "Default Name",
                    created_at: new Date(),
                });
                await this.createLog(req, 'verifyRegistration', 'users', 200, userId);
                return res.status(200).json({ message: "Registration successful" });
            }
            else {
                await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
                return res.status(400).json({ message: "Registration verification failed" });
            }
        }
        catch (error) {
            await this.createLog(req, 'verifyRegistration', 'users', 500, userId);
            res.status(500).json({ message: "Error verifying registration" });
        }
    }
    async getAuthenticationOptionsHandler(req, res) {
        const userId = req.body.userId;
        let credentials = [];
        try {
            if (userId) {
                const user = await this.userService.getUser(userId);
                credentials = JSON.parse(user?.webauthn_credentials || "[]");
            }
            else {
                // Si pas d'userId, retourne les options sans credentials (découverte par le navigateur)
                credentials = [];
            }
            const options = await (0, webauthnService_1.getAuthenticationOptions)(credentials);
            const challengeBase64 = Buffer.from(options.challenge).toString('base64');
            await this.userService.updateWebauthnChallenge(userId, challengeBase64);
            options.challenge = challengeBase64;
            await this.createLog(req, 'getAuthenticationOptionsHandler', 'users', 200, userId);
            res.status(200).json(options);
        }
        catch (error) {
            await this.createLog(req, 'getAuthenticationOptionsHandler', 'users', 500, userId);
            res.status(500).json({ message: "Error generating authentication options" });
        }
    }
    async verifyAuthenticationHandler(req, res) {
        const { credential, userId } = req.body;
        if (!credential) {
            await this.createLog(req, 'verifyAuthenticationHandler', 'users', 400, userId);
            return res.status(400).json({ message: "Credential is required" });
        }
        try {
            credential.id = credential.id.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); // Assure que l'ID est en base64url
            // Si pas d'userId, retrouve l'utilisateur par credential.id
            let user;
            if (userId) {
                user = await this.userService.getUser(userId);
            }
            else if (credential.id) {
                user = await this.userService.getUserByCredentialId(credential.id);
            }
            if (!user) {
                await this.createLog(req, 'verifyAuthenticationHandler', 'users', 404, userId);
                return res.status(404).json({ message: "User not found" });
            }
            const token = (0, GenKey_1.genKey)(user.user_id);
            await this.createLog(req, 'verifyAuthenticationHandler', 'users', 200, user.user_id);
            res.status(200).json({ message: "Authentication successful", token });
        }
        catch (error) {
            await this.createLog(req, 'verifyAuthenticationHandler', 'users', 500, userId);
            res.status(500).json({ message: "Error verifying authentication" });
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpPost)("/register/options"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WebAuthn.prototype, "getRegistrationOptions", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/register/verify"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WebAuthn.prototype, "verifyRegistration", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/authenticate/options"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WebAuthn.prototype, "getAuthenticationOptionsHandler", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/authenticate/verify"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], WebAuthn.prototype, "verifyAuthenticationHandler", null);
WebAuthn = __decorate([
    (0, inversify_express_utils_1.controller)("/webauthn"),
    __param(0, (0, inversify_1.inject)("UserService")),
    __param(1, (0, inversify_1.inject)("LogService")),
    __metadata("design:paramtypes", [Object, Object])
], WebAuthn);
exports.WebAuthn = WebAuthn;
