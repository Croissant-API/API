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
let Authenticator = class Authenticator {
    constructor(userService) {
        this.userService = userService;
    }
    async generateKey(req, res) {
        const user = req.user;
        if (!user || !user.email) {
            return res.status(400).send({ message: "User not authenticated or email missing" });
        }
        const key = time2fa_1.Totp.generateKey({ issuer: "Croissant API", user: user.email });
        qrcode.toDataURL(key.url, (err, url) => {
            if (err) {
                console.error("Error generating QR code:", err);
                return res.status(500).send({ message: "Error generating QR code" });
            }
            res.status(200).send({ key, qrCode: url });
        });
    }
    async registerKey(req, res) {
        const user = req.user;
        const { key, passcode } = req.body;
        if (!user || !user.email || !key) {
            return res.status(400).send({ message: "User not authenticated, email missing, or key missing" });
        }
        if (!passcode) {
            return res.status(400).send({ message: "Passcode is required" });
        }
        const isValid = time2fa_1.Totp.validate({ secret: key.secret, passcode });
        if (!isValid) {
            return res.status(400).send({ message: "Invalid passcode" });
        }
        await this.userService.setAuthenticatorSecret(user.user_id, key.secret);
        res.status(200).send({ message: "Key registered successfully" });
    }
    async verifyKey(req, res) {
        const { code, userId } = req.body;
        if (!userId) {
            return res.status(400).send({ message: "User ID is required" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        const key = user.authenticator_secret;
        if (!key || !code) {
            return res.status(400).send({ message: "Key and code are required" });
        }
        const isValid = time2fa_1.Totp.validate({ secret: key, passcode: code });
        if (isValid) {
            return res.status(200).send({ message: "Key verified successfully", token: (0, GenKey_1.genKey)(user.user_id) });
        }
        else {
            return res.status(400).send({ message: "Invalid key or code" });
        }
    }
    async deleteKey(req, res) {
        const user = req.user;
        if (!user || !user.email) {
            return res.status(400).send({ message: "User not authenticated or email missing" });
        }
        await this.userService.setAuthenticatorSecret(user.user_id, null);
        res.status(200).send({ message: "Google Authenticator deleted successfully" });
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
    __metadata("design:paramtypes", [Object])
], Authenticator);
exports.Authenticator = Authenticator;
