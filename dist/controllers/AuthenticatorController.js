"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Authenticator = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const inversify_express_utils_1 = require("inversify-express-utils");
const inversify_1 = require("inversify");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const qrcode = __importStar(require("qrcode"));
const time2fa_1 = require("time2fa");
const GenKey_1 = require("../utils/GenKey");
// --- UTILS ---
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
let Authenticator = class Authenticator {
    constructor(userService, logService // décommenté pour logger
    ) {
        this.userService = userService;
        this.logService = logService;
    }
    // Helper pour les logs (utilise logService maintenant)
    async logAction(req, action, statusCode, metadata) {
        try {
            const requestBody = { ...req.body };
            if (metadata)
                requestBody.metadata = metadata;
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] || req.socket.remoteAddress,
                table_name: "authenticator",
                controller: `AuthenticatorController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: req.user?.user_id,
                status_code: statusCode
            });
        }
        catch (error) {
            console.error('Error creating log:', error);
        }
    }
    async generateKey(req, res) {
        const user = req.user;
        if (!user || !user.email) {
            await this.logAction(req, "generateKey", 400);
            return res.status(400).send({ message: "User not authenticated or email missing" });
        }
        try {
            const key = time2fa_1.Totp.generateKey({ issuer: "Croissant API", user: user.email });
            qrcode.toDataURL(key.url, async (err, url) => {
                if (err) {
                    await this.logAction(req, "generateKey", 500, { error: err });
                    return res.status(500).send({ message: "Error generating QR code" });
                }
                await this.logAction(req, "generateKey", 200);
                res.status(200).send({ key, qrCode: url });
            });
        }
        catch (error) {
            await this.logAction(req, "generateKey", 500, { error });
            handleError(res, error, "Error generating key");
        }
    }
    async registerKey(req, res) {
        const user = req.user;
        const { key, passcode } = req.body;
        if (!user || !user.email || !key) {
            await this.logAction(req, "registerKey", 400);
            return res.status(400).send({ message: "User not authenticated, email missing, or key missing" });
        }
        if (!passcode) {
            await this.logAction(req, "registerKey", 400);
            return res.status(400).send({ message: "Passcode is required" });
        }
        try {
            const isValid = time2fa_1.Totp.validate({ secret: key.secret, passcode });
            if (!isValid) {
                await this.logAction(req, "registerKey", 400);
                return res.status(400).send({ message: "Invalid passcode" });
            }
            await this.userService.setAuthenticatorSecret(user.user_id, key.secret);
            await this.logAction(req, "registerKey", 200);
            res.status(200).send({ message: "Key registered successfully" });
        }
        catch (error) {
            await this.logAction(req, "registerKey", 500, { error });
            handleError(res, error, "Error registering key");
        }
    }
    async verifyKey(req, res) {
        const { code, userId } = req.body;
        if (!userId) {
            await this.logAction(req, "verifyKey", 400);
            return res.status(400).send({ message: "User ID is required" });
        }
        try {
            const user = await this.userService.getUser(userId);
            if (!user) {
                await this.logAction(req, "verifyKey", 404);
                return res.status(404).send({ message: "User not found" });
            }
            const key = user.authenticator_secret;
            if (!key || !code) {
                await this.logAction(req, "verifyKey", 400);
                return res.status(400).send({ message: "Key and code are required" });
            }
            const isValid = time2fa_1.Totp.validate({ secret: key, passcode: code });
            if (isValid) {
                await this.logAction(req, "verifyKey", 200);
                return res.status(200).send({ message: "Key verified successfully", token: (0, GenKey_1.genKey)(user.user_id) });
            }
            else {
                await this.logAction(req, "verifyKey", 400);
                return res.status(400).send({ message: "Invalid key or code" });
            }
        }
        catch (error) {
            await this.logAction(req, "verifyKey", 500, { error });
            handleError(res, error, "Error verifying key");
        }
    }
    async deleteKey(req, res) {
        const user = req.user;
        if (!user || !user.email) {
            await this.logAction(req, "deleteKey", 400);
            return res.status(400).send({ message: "User not authenticated or email missing" });
        }
        try {
            await this.userService.setAuthenticatorSecret(user.user_id, null);
            await this.logAction(req, "deleteKey", 200);
            res.status(200).send({ message: "Google Authenticator deleted successfully" });
        }
        catch (error) {
            await this.logAction(req, "deleteKey", 500, { error });
            handleError(res, error, "Error deleting authenticator");
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpPost)("/generateKey", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Authenticator.prototype, "generateKey", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/registerKey", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Authenticator.prototype, "registerKey", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/verifyKey"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Authenticator.prototype, "verifyKey", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/delete", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Authenticator.prototype, "deleteKey", null);
Authenticator = __decorate([
    (0, inversify_express_utils_1.controller)("/authenticator"),
    __param(0, (0, inversify_1.inject)("UserService")),
    __param(1, (0, inversify_1.inject)("LogService")),
    __metadata("design:paramtypes", [Object, Object])
], Authenticator);
exports.Authenticator = Authenticator;
