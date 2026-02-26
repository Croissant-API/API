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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebAuthn = void 0;
const inversify_1 = require("inversify");
const hono_inversify_1 = require("../hono-inversify");
const webauthnService_1 = require("../lib/webauthnService");
const GenKey_1 = require("../utils/GenKey");
const Jwt_1 = require("../utils/Jwt");
let WebAuthn = class WebAuthn {
    constructor(userService, logService) {
        this.userService = userService;
        this.logService = logService;
    }
    async createLog(req, action, tableName, statusCode, userId, metadata) {
        try {
            const requestBody = { ...req.body };
            if (metadata)
                requestBody.metadata = metadata;
            await this.logService.createLog({
                ip_address: req.headers['x-real-ip'] || req.socket.remoteAddress,
                table_name: tableName,
                controller: `WebAuthnController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: userId,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    async getRegistrationOptions(req, res) {
        const userId = req.body.userId;
        if (!userId) {
            await this.createLog(req, 'getRegistrationOptions', 'users', 400);
            return res.status(400).json({ message: 'User ID is required' });
        }
        try {
            const options = await (0, webauthnService_1.getRegistrationOptions)(userId);
            const challengeBase64 = Buffer.from(options.challenge).toString('base64');
            await this.userService.updateWebauthnChallenge(userId, challengeBase64);
            options.challenge = challengeBase64;
            options.user.id = Buffer.from(options.user.id).toString('base64');
            await this.createLog(req, 'getRegistrationOptions', 'users', 200, userId);
            res.status(200).json(options);
        }
        catch (e) {
            await this.createLog(req, 'getRegistrationOptions', 'users', 500, undefined, { error: e.message });
            res.status(500).json({ message: 'Error generating registration options' });
        }
    }
    async verifyRegistration(req, res) {
        const { credential, userId } = req.body;
        if (!credential) {
            await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
            return res.status(400).json({ message: 'Credential is required' });
        }
        try {
            const user = await this.userService.getUser(userId);
            const expectedChallenge = user?.webauthn_challenge;
            if (!expectedChallenge) {
                await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
                return res.status(400).json({ message: 'No challenge found' });
            }
            function base64ToBase64url(str) {
                return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            }
            const expectedChallengeBase64url = base64ToBase64url(expectedChallenge);
            const verification = await (0, webauthnService_1.verifyRegistration)({ credential }, expectedChallengeBase64url);
            if (verification) {
                await this.userService.updateWebauthnChallenge(credential.id, null);
                await this.userService.addWebauthnCredential(userId, {
                    id: credential.id,
                    name: credential.name || 'Default Name',
                    created_at: new Date(),
                });
                await this.createLog(req, 'verifyRegistration', 'users', 200, userId);
                return res.status(200).json({ message: 'Registration successful' });
            }
            else {
                await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
                return res.status(400).json({ message: 'Registration verification failed' });
            }
        }
        catch (error) {
            await this.createLog(req, 'verifyRegistration', 'users', 500, userId, {
                error: error.message,
            });
            res.status(500).json({ message: 'Error verifying registration' });
        }
    }
    async getAuthenticationOptionsHandler(req, res) {
        const userId = req.body.userId;
        let credentials = [];
        try {
            if (userId) {
                const user = await this.userService.getUser(userId);
                credentials = JSON.parse(user?.webauthn_credentials || '[]');
            }
            else {
                credentials = [];
            }
            const options = await (0, webauthnService_1.getAuthenticationOptions)(credentials);
            const challengeBase64 = Buffer.from(options.challenge).toString('base64');
            if (userId) {
                await this.userService.updateWebauthnChallenge(userId, challengeBase64);
            }
            options.challenge = challengeBase64;
            await this.createLog(req, 'getAuthenticationOptionsHandler', 'users', 200, userId);
            res.status(200).json(options);
        }
        catch (error) {
            console.error('Error generating authentication options:', error);
            await this.createLog(req, 'getAuthenticationOptionsHandler', 'users', 500, userId, { error: error.message });
            res.status(500).json({ message: 'Error generating authentication options' });
        }
    }
    async verifyAuthenticationHandler(req, res) {
        const { credential, userId } = req.body;
        if (!credential) {
            await this.createLog(req, 'verifyAuthenticationHandler', 'users', 400, userId);
            return res.status(400).json({ message: 'Credential is required' });
        }
        try {
            credential.id = credential.id.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            let user;
            if (userId) {
                user = await this.userService.getUser(userId);
            }
            else if (credential.id) {
                user = await this.userService.getUserByCredentialId(credential.id);
            }
            if (!user) {
                await this.createLog(req, 'verifyAuthenticationHandler', 'users', 404, userId);
                return res.status(404).json({ message: 'User not found' });
            }
            const apiKey = (0, GenKey_1.genKey)(user.user_id);
            const jwtToken = (0, Jwt_1.generateUserJwt)(user, apiKey);
            await this.createLog(req, 'verifyAuthenticationHandler', 'users', 200, user.user_id);
            res.status(200).json({ message: 'Authentication successful', token: jwtToken });
        }
        catch (error) {
            await this.createLog(req, 'verifyAuthenticationHandler', 'users', 500, userId, { error: error.message });
            res.status(500).json({ message: 'Error verifying authentication' });
        }
    }
};
exports.WebAuthn = WebAuthn;
__decorate([
    (0, hono_inversify_1.httpPost)('/register/options')
], WebAuthn.prototype, "getRegistrationOptions", null);
__decorate([
    (0, hono_inversify_1.httpPost)('/register/verify')
], WebAuthn.prototype, "verifyRegistration", null);
__decorate([
    (0, hono_inversify_1.httpPost)('/authenticate/options')
], WebAuthn.prototype, "getAuthenticationOptionsHandler", null);
__decorate([
    (0, hono_inversify_1.httpPost)('/authenticate/verify')
], WebAuthn.prototype, "verifyAuthenticationHandler", null);
exports.WebAuthn = WebAuthn = __decorate([
    (0, hono_inversify_1.controller)('/webauthn'),
    __param(0, (0, inversify_1.inject)('UserService')),
    __param(1, (0, inversify_1.inject)('LogService'))
], WebAuthn);
