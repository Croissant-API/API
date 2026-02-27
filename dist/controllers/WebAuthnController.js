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
import { controller, httpPost } from '../hono-inversify';
import { getAuthenticationOptions, getRegistrationOptions, verifyRegistration } from '../lib/webauthnService';
import { genKey } from '../utils/GenKey';
import { generateUserJwt } from '../utils/Jwt';
let WebAuthns = class WebAuthns {
    constructor(userService, logService) {
        this.userService = userService;
        this.logService = logService;
    }
    sendError(c, status, message) {
        return c.json({ message }, status);
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
                controller: `WebAuthnController.${action}`,
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
    async getRegistrationOptions(c) {
        try {
            const body = await c.req.json();
            const { userId } = body;
            if (!userId) {
                await this.createLog(c, 'getRegistrationOptions', 'users', 400, undefined, undefined, body);
                return this.sendError(c, 400, 'User ID is required');
            }
            const options = await getRegistrationOptions(userId);
            const challengeBase64 = Buffer.from(options.challenge).toString('base64');
            await this.userService.updateWebauthnChallenge(userId, challengeBase64);
            options.challenge = challengeBase64;
            options.user.id = Buffer.from(options.user.id).toString('base64');
            await this.createLog(c, 'getRegistrationOptions', 'users', 200, userId, undefined, body);
            return c.json(options, 200);
        }
        catch (e) {
            console.error('Error generating registration options:', e);
            await this.createLog(c, 'getRegistrationOptions', 'users', 500, undefined, { error: e.message });
            return this.sendError(c, 500, 'Error generating registration options');
        }
    }
    async verifyRegistration(c) {
        try {
            const body = await c.req.json();
            const { credential, userId } = body;
            if (!credential) {
                await this.createLog(c, 'verifyRegistration', 'users', 400, userId, undefined, body);
                return this.sendError(c, 400, 'Credential is required');
            }
            const user = await this.userService.getUser(userId);
            const expectedChallenge = user?.webauthn_challenge;
            if (!expectedChallenge) {
                await this.createLog(c, 'verifyRegistration', 'users', 400, userId, undefined, body);
                return this.sendError(c, 400, 'No challenge found');
            }
            function base64ToBase64url(str) {
                return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            }
            const expectedChallengeBase64url = base64ToBase64url(expectedChallenge);
            const verification = await verifyRegistration({ credential }, expectedChallengeBase64url);
            if (verification) {
                await this.userService.updateWebauthnChallenge(credential.id, null);
                await this.userService.addWebauthnCredential(userId, {
                    id: credential.id,
                    name: credential.name || 'Default Name',
                    created_at: new Date(),
                });
                await this.createLog(c, 'verifyRegistration', 'users', 200, userId, undefined, body);
                return c.json({ message: 'Registration successful' }, 200);
            }
            else {
                await this.createLog(c, 'verifyRegistration', 'users', 400, userId, undefined, body);
                return this.sendError(c, 400, 'Registration verification failed');
            }
        }
        catch (error) {
            console.error('Error verifying registration:', error);
            await this.createLog(c, 'verifyRegistration', 'users', 500, undefined, { error: error.message });
            return this.sendError(c, 500, 'Error verifying registration');
        }
    }
    async getAuthenticationOptionsHandler(c) {
        try {
            const body = await c.req.json();
            const { userId } = body;
            let credentials = [];
            if (userId) {
                const user = await this.userService.getUser(userId);
                credentials = JSON.parse(user?.webauthn_credentials || '[]');
            }
            else {
                credentials = [];
            }
            const options = await getAuthenticationOptions(credentials);
            const challengeBase64 = Buffer.from(options.challenge).toString('base64');
            if (userId) {
                await this.userService.updateWebauthnChallenge(userId, challengeBase64);
            }
            options.challenge = challengeBase64;
            await this.createLog(c, 'getAuthenticationOptionsHandler', 'users', 200, userId, undefined, body);
            return c.json(options, 200);
        }
        catch (error) {
            console.error('Error generating authentication options:', error);
            await this.createLog(c, 'getAuthenticationOptionsHandler', 'users', 500, undefined, { error: error.message });
            return this.sendError(c, 500, 'Error generating authentication options');
        }
    }
    async verifyAuthenticationHandler(c) {
        try {
            const body = await c.req.json();
            const { credential, userId } = body;
            if (!credential) {
                await this.createLog(c, 'verifyAuthenticationHandler', 'users', 400, userId, undefined, body);
                return this.sendError(c, 400, 'Credential is required');
            }
            credential.id = credential.id.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            let user;
            if (userId) {
                user = await this.userService.getUser(userId);
            }
            else if (credential.id) {
                user = await this.userService.getUserByCredentialId(credential.id);
            }
            if (!user) {
                await this.createLog(c, 'verifyAuthenticationHandler', 'users', 404, userId, undefined, body);
                return this.sendError(c, 404, 'User not found');
            }
            const apiKey = genKey(user.user_id);
            const jwtToken = generateUserJwt(user, apiKey);
            await this.createLog(c, 'verifyAuthenticationHandler', 'users', 200, user.user_id, undefined, body);
            return c.json({ message: 'Authentication successful', token: jwtToken }, 200);
        }
        catch (error) {
            console.error('Error verifying authentication:', error);
            await this.createLog(c, 'verifyAuthenticationHandler', 'users', 500, undefined, { error: error.message });
            return this.sendError(c, 500, 'Error verifying authentication');
        }
    }
};
__decorate([
    httpPost('/register/options'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], WebAuthns.prototype, "getRegistrationOptions", null);
__decorate([
    httpPost('/register/verify'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], WebAuthns.prototype, "verifyRegistration", null);
__decorate([
    httpPost('/authenticate/options'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], WebAuthns.prototype, "getAuthenticationOptionsHandler", null);
__decorate([
    httpPost('/authenticate/verify'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], WebAuthns.prototype, "verifyAuthenticationHandler", null);
WebAuthns = __decorate([
    injectable(),
    controller('/webauthn'),
    __param(0, inject('UserService')),
    __param(1, inject('LogService')),
    __metadata("design:paramtypes", [Object, Object])
], WebAuthns);
export { WebAuthns };
