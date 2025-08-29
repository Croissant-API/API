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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Users = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const inversify_1 = require("inversify");
const crypto_1 = __importDefault(require("crypto"));
const inversify_express_utils_1 = require("inversify-express-utils");
const UserValidator_1 = require("../validators/UserValidator");
const describe_1 = require("../decorators/describe");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const GenKey_1 = require("../utils/GenKey");
const MailService_1 = require("../services/MailService");
const StudioService_1 = require("../services/StudioService");
const SteamOAuthService_1 = require("../services/SteamOAuthService");
const helpers_1 = require("../utils/helpers");
const Jwt_1 = require("../utils/Jwt");
let Users = class Users {
    constructor(userService, logService, mailService, studioService, steamOAuthService) {
        this.userService = userService;
        this.logService = logService;
        this.mailService = mailService;
        this.studioService = studioService;
        this.steamOAuthService = steamOAuthService;
    }
    // --- HELPERS ---
    sendError(res, status, message) {
        return res.status(status).send({ message });
    }
    async createLog(req, action, tableName, statusCode, userId, metadata) {
        try {
            const requestBody = { ...req.body };
            if (metadata)
                requestBody.metadata = metadata;
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] || req.socket.remoteAddress,
                table_name: tableName,
                controller: `UserController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: userId,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error("Error creating log:", error);
        }
    }
    mapUser(user) {
        return {
            id: user.user_id,
            userId: user.user_id,
            username: user.username,
            email: user.email,
            balance: user.balance !== undefined ? Math.floor(user.balance) : undefined,
            verified: !!user.verified,
            steam_id: user.steam_id,
            steam_username: user.steam_username,
            steam_avatar_url: user.steam_avatar_url,
            isStudio: !!user.isStudio,
            admin: !!user.admin,
            disabled: !!user.disabled,
            badges: user.badges || [],
            created_at: user.created_at, // <-- Ajout ici
        };
    }
    mapUserSearch(user) {
        return {
            id: user.user_id,
            userId: user.user_id,
            username: user.username,
            verified: user.verified,
            isStudio: user.isStudio,
            admin: !!user.admin,
            badges: user.badges || [],
            disabled: !!user.disabled,
            created_at: user.created_at, // <-- Ajout ici
        };
    }
    // --- AUTHENTIFICATION & INSCRIPTION ---
    async loginOAuth(req, res) {
        const { provider, code } = req.body;
        if (!provider || !code) {
            await this.createLog(req, "loginOAuth", "users", 400);
            return this.sendError(res, 400, "Missing provider or code");
        }
        let accessToken;
        let verifiedUser;
        if (provider === "discord") {
            const redirectUri = process.env.DISCORD_CALLBACK_URL;
            if (!redirectUri) {
                await this.createLog(req, "loginOAuth", "users", 500);
                return this.sendError(res, 500, "Discord redirect_uri is not set in environment variables");
            }
            const params = new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: redirectUri,
            });
            const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString(),
            });
            if (!tokenRes.ok) {
                const errorText = await tokenRes.text();
                console.error("Discord token error:", errorText);
                console.error("Params sent to Discord:", params.toString());
                await this.createLog(req, "loginOAuth", "users", 500);
                return this.sendError(res, 500, "Failed to fetch Discord access token: " + errorText);
            }
            const tokenData = await tokenRes.json();
            accessToken = tokenData.access_token;
            verifiedUser = await this.verifyDiscordToken(accessToken);
        }
        else if (provider === "google") {
            const params = new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.GOOGLE_CALLBACK_URL,
            });
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString(),
            });
            if (!tokenRes.ok)
                return this.sendError(res, 500, "Failed to fetch Google access token");
            const tokenData = await tokenRes.json();
            accessToken = tokenData.access_token;
            verifiedUser = await this.verifyGoogleToken(accessToken);
        }
        else {
            return this.sendError(res, 400, "Unsupported OAuth provider");
        }
        const users = await this.userService.getAllUsersWithDisabled();
        const token = req.headers["cookie"]?.toString().split("token=")[1]?.split(";")[0];
        let user = await this.userService.authenticateUser(token);
        if (!verifiedUser) {
            await this.createLog(req, "loginOAuth", "users", 500);
            return this.sendError(res, 500, "Failed to verify OAuth user");
        }
        if (!user) {
            user = users.find((u) => (provider === "discord" && u.discord_id == verifiedUser.id) ||
                (provider === "google" && u.google_id == verifiedUser.id)) || null;
        }
        if (!user) {
            const userId = crypto_1.default.randomUUID();
            user = await this.userService.createUser(userId, verifiedUser.username, verifiedUser.email, null, provider, verifiedUser.id);
            await this.createLog(req, "loginOAuth", "users", 201, userId);
        }
        else {
            if ((provider === "discord" && !user.discord_id) || (provider === "google" && !user.google_id)) {
                await this.userService.associateOAuth(user.user_id, provider, verifiedUser.id);
            }
            if ((provider === "discord" && user.discord_id && user.discord_id != verifiedUser.id) ||
                (provider === "google" && user.google_id && user.google_id != verifiedUser.id)) {
                await this.createLog(req, "loginOAuth", "users", 401, user.user_id);
                return this.sendError(res, 401, "OAuth providerId mismatch");
            }
        }
        if (user.disabled) {
            await this.createLog(req, "loginOAuth", "users", 403, user.user_id);
            return this.sendError(res, 403, "Account is disabled");
        }
        await this.createLog(req, "loginOAuth", "users", 200, user.user_id);
        const apiKey = (0, GenKey_1.genKey)(user.user_id);
        const jwtToken = (0, Jwt_1.generateUserJwt)(user, apiKey);
        res.status(200).send({
            message: "Login successful",
            token: jwtToken,
            user: {
                userId: user.user_id,
                username: user.username,
                email: user.email,
            },
        });
    }
    async register(req, res) {
        const missing = (0, helpers_1.requireFields)(req.body, ["username", "email"]);
        if (missing || (!req.body.password && !req.body.provider)) {
            await this.createLog(req, "register", "users", 400);
            return this.sendError(res, 400, "Missing required fields");
        }
        const users = await this.userService.getAllUsersWithDisabled();
        if (users.find((u) => u.email === req.body.email)) {
            await this.createLog(req, "register", "users", 400);
            return this.sendError(res, 400, "Email already exists");
        }
        let userId = req.body.userId;
        if (!userId) {
            userId = crypto_1.default.randomUUID();
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(req.body.email)) {
            await this.createLog(req, "register", "users", 400);
            return this.sendError(res, 400, "Invalid email address");
        }
        let hashedPassword = null;
        if (req.body.password) {
            if (typeof req.body.password !== "string") {
                await this.createLog(req, "register", "users", 400);
                return this.sendError(res, 400, "Invalid password");
            }
            hashedPassword = await bcryptjs_1.default.hash(req.body.password, 10);
        }
        try {
            const user = await this.userService.createUser(userId, req.body.username, req.body.email, hashedPassword, req.body.provider, req.body.providerId);
            await this.mailService.sendAccountConfirmationMail(user.email);
            await this.createLog(req, "register", "users", 201, userId);
            const apiKey = (0, GenKey_1.genKey)(user.user_id);
            const jwtToken = (0, Jwt_1.generateUserJwt)(user, apiKey);
            res.status(201).send({ message: "User registered", token: jwtToken });
        }
        catch (error) {
            console.error("Error registering user", error);
            await this.createLog(req, "register", "users", 500);
            this.sendError(res, 500, "Error registering user");
        }
    }
    async login(req, res) {
        const allUsers = await this.userService.getAllUsersWithDisabled();
        const user = allUsers.find((u) => u.email === req.body.email);
        if (!user || !user.password) {
            await this.createLog(req, "login", "users", 401);
            return this.sendError(res, 401, "Invalid credentials");
        }
        const valid = await bcryptjs_1.default.compare(req.body.password, user.password);
        if (!valid) {
            await this.createLog(req, "login", "users", 401, user.user_id);
            return this.sendError(res, 401, "Invalid credentials");
        }
        if (user.disabled) {
            await this.createLog(req, "login", "users", 403, user.user_id);
            return this.sendError(res, 403, "Account is disabled");
        }
        this.mailService.sendConnectionNotificationMail(user.email, user.username).catch((err) => {
            console.error("Error sending connection notification email", err);
        });
        await this.createLog(req, "login", "users", 200, user.user_id);
        if (!user.authenticator_secret) {
            const apiKey = (0, GenKey_1.genKey)(user.user_id);
            const jwtToken = (0, Jwt_1.generateUserJwt)(user, apiKey);
            res.status(200).send({
                message: "Login successful",
                token: jwtToken,
            });
        }
        else {
            res.status(200).send({
                message: "Login successful",
                user: {
                    userId: user.user_id,
                    username: user.username,
                    email: user.email,
                },
            });
        }
    }
    // --- PROFIL UTILISATEUR ---
    async getMe(req, res) {
        const userId = req.user?.user_id;
        if (!userId) {
            await this.createLog(req, "getMe", "users", 401);
            return this.sendError(res, 401, "Unauthorized");
        }
        const userWithData = await this.userService.getUserWithCompleteProfile(userId);
        if (!userWithData) {
            await this.createLog(req, "getMe", "users", 404, userId);
            return this.sendError(res, 404, "User not found");
        }
        const studios = await this.studioService.getUserStudios(req.originalUser?.user_id || userId);
        const roles = [req.originalUser?.user_id, ...studios.map((s) => s.user_id)];
        await this.createLog(req, "getMe", "users", 200, userId);
        res.send({
            ...this.mapUser(userWithData),
            verificationKey: (0, GenKey_1.genVerificationKey)(userWithData.user_id),
            google_id: userWithData.google_id,
            discord_id: userWithData.discord_id,
            studios,
            roles,
            inventory: userWithData.inventory || [],
            ownedItems: userWithData.ownedItems || [],
            createdGames: userWithData.createdGames || [],
            haveAuthenticator: !!userWithData.authenticator_secret,
        });
    }
    async changeUsername(req, res) {
        const userId = req.user?.user_id;
        const { username } = req.body;
        if (!userId) {
            await this.createLog(req, "changeUsername", "users", 401);
            return this.sendError(res, 401, "Unauthorized");
        }
        if (!username || typeof username !== "string" || username.trim().length < 3) {
            await this.createLog(req, "changeUsername", "users", 400, userId);
            return this.sendError(res, 400, "Invalid username (min 3 characters)");
        }
        try {
            await this.userService.updateUser(userId, username.trim());
            await this.createLog(req, "changeUsername", "users", 200, userId);
            res.status(200).send({ message: "Username updated" });
        }
        catch (error) {
            await this.createLog(req, "changeUsername", "users", 500, userId);
            this.sendError(res, 500, "Error updating username");
        }
    }
    async changePassword(req, res) {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        if (!newPassword || !confirmPassword) {
            await this.createLog(req, "changePassword", "users", 400, req.user?.user_id);
            return this.sendError(res, 400, "Missing newPassword or confirmPassword");
        }
        if (newPassword !== confirmPassword) {
            await this.createLog(req, "changePassword", "users", 400, req.user?.user_id);
            return this.sendError(res, 400, "New password and confirm password do not match");
        }
        const userId = req.user?.user_id;
        if (!userId) {
            await this.createLog(req, "changePassword", "users", 401);
            return this.sendError(res, 401, "Unauthorized");
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            await this.createLog(req, "changePassword", "users", 404, userId);
            return this.sendError(res, 404, "User not found");
        }
        let valid = true;
        if (user.password)
            valid = await bcryptjs_1.default.compare(oldPassword, user.password);
        if (!valid) {
            await this.createLog(req, "changePassword", "users", 401, userId);
            return this.sendError(res, 401, "Invalid current password");
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        try {
            await this.userService.updateUserPassword(userId, hashedPassword);
            await this.createLog(req, "changePassword", "users", 200, userId);
            res.status(200).send({ message: "Password changed successfully" });
        }
        catch (error) {
            await this.createLog(req, "changePassword", "users", 500, userId);
            this.sendError(res, 500, "Error changing password");
        }
    }
    async forgotPassword(req, res) {
        const { email } = req.body;
        if (!email) {
            await this.createLog(req, "forgotPassword", "users", 400);
            return this.sendError(res, 400, "Email is required");
        }
        const user = await this.userService.findByEmail(email);
        if (!user) {
            await this.createLog(req, "forgotPassword", "users", 404);
            return this.sendError(res, 404, "Invalid email");
        }
        const passwordResetToken = await this.userService.generatePasswordResetToken(email);
        await this.mailService.sendPasswordResetMail(email, passwordResetToken);
        await this.createLog(req, "forgotPassword", "users", 200, user.user_id);
        res.status(200).send({ message: "Password reset email sent" });
    }
    async resetPassword(req, res) {
        const { new_password, confirm_password, reset_token } = req.body;
        if (!new_password || !reset_token || !confirm_password) {
            await this.createLog(req, "resetPassword", "users", 400);
            return this.sendError(res, 400, "Missing required fields");
        }
        if (new_password !== confirm_password) {
            await this.createLog(req, "resetPassword", "users", 400);
            return this.sendError(res, 400, "New password and confirm password do not match");
        }
        const user = await this.userService.findByResetToken(reset_token);
        if (!user) {
            await this.createLog(req, "resetPassword", "users", 404);
            return this.sendError(res, 404, "Invalid user");
        }
        const hashedPassword = await bcryptjs_1.default.hash(new_password, 10);
        try {
            await this.userService.updateUserPassword(user.user_id, hashedPassword);
            await this.createLog(req, "resetPassword", "users", 200, user.user_id);
            const apiKey = (0, GenKey_1.genKey)(user.user_id);
            const jwtToken = (0, Jwt_1.generateUserJwt)(user, apiKey);
            res.status(200).send({ message: "Password reset successfully", token: jwtToken });
        }
        catch (error) {
            await this.createLog(req, "resetPassword", "users", 500, user.user_id);
            this.sendError(res, 500, "Error resetting password");
        }
    }
    async isValidResetToken(req, res) {
        const { reset_token } = req.query;
        if (!reset_token) {
            await this.createLog(req, "isValidResetToken", "users", 400);
            return this.sendError(res, 400, "Missing required fields");
        }
        const user = await this.userService.findByResetToken(reset_token);
        if (!user) {
            await this.createLog(req, "isValidResetToken", "users", 404);
            return this.sendError(res, 404, "Invalid reset token");
        }
        await this.createLog(req, "isValidResetToken", "users", 200, user.user_id);
        res.status(200).send({ message: "Valid reset token", user });
    }
    // --- STEAM ---
    async steamRedirect(req, res) {
        const url = this.steamOAuthService.getAuthUrl();
        await this.createLog(req, "steamRedirect", "users", 200);
        res.send(url);
    }
    async steamAssociate(req, res) {
        const user = req.user;
        if (!user) {
            await this.createLog(req, "steamAssociate", "users", 401);
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            const steamId = await this.steamOAuthService.verifySteamOpenId(req.query);
            if (!steamId) {
                await this.createLog(req, "steamAssociate", "users", 400, user.user_id);
                return res.status(400).send({ message: "Steam authentication failed" });
            }
            const profile = await this.steamOAuthService.getSteamProfile(steamId);
            if (!profile) {
                await this.createLog(req, "steamAssociate", "users", 400, user.user_id);
                return res.status(400).send({ message: "Unable to fetch Steam profile" });
            }
            await this.userService.updateSteamFields(user.user_id, profile.steamid, profile.personaname, profile.avatarfull);
            await this.createLog(req, "steamAssociate", "users", 200, user.user_id);
            res.send(`<html><head><meta http-equiv="refresh" content="0;url=/settings"></head><body>Redirecting to <a href="/settings">/settings</a>...</body></html>`);
        }
        catch (error) {
            console.error("Error associating Steam account", error);
            await this.createLog(req, "steamAssociate", "users", 500, user?.user_id);
        }
    }
    async unlinkSteam(req, res) {
        const userId = req.user?.user_id;
        if (!userId) {
            await this.createLog(req, "unlinkSteam", "users", 401);
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            await this.userService.updateSteamFields(userId, null, null, null);
            await this.createLog(req, "unlinkSteam", "users", 200, userId);
            res.status(200).send({ message: "Steam account unlinked" });
        }
        catch (error) {
            console.error("Error unlinking Steam account", error);
            await this.createLog(req, "unlinkSteam", "users", 500, userId);
            this.sendError(res, 500, "Error unlinking Steam account");
        }
    }
    // --- RECHERCHE UTILISATEUR ---
    async searchUsers(req, res) {
        const query = req.query.q?.trim();
        if (!query) {
            await this.createLog(req, "searchUsers", "users", 400);
            return this.sendError(res, 400, "Missing search query");
        }
        try {
            const users = await this.userService.searchUsersByUsername(query);
            await this.createLog(req, "searchUsers", "users", 200);
            res.send(users.map((user) => this.mapUserSearch(user)));
        }
        catch (error) {
            await this.createLog(req, "searchUsers", "users", 500);
            this.sendError(res, 500, "Error searching users");
        }
    }
    async getUser(req, res) {
        try {
            await UserValidator_1.userIdParamValidator.validate(req.params);
        }
        catch (err) {
            await this.createLog(req, "getUser", "users", 400);
            return this.sendError(res, 400, "Invalid userId");
        }
        const { userId } = req.params;
        const userWithData = await this.userService.getUserWithPublicProfile(userId);
        if (!userWithData) {
            await this.createLog(req, "getUser", "users", 404);
            return this.sendError(res, 404, "User not found");
        }
        await this.createLog(req, "getUser", "users", 200);
        res.send({
            ...this.mapUserSearch(userWithData),
            inventory: userWithData.inventory || [],
            ownedItems: userWithData.ownedItems || [],
            createdGames: userWithData.createdGames || [],
        });
    }
    // --- ADMINISTRATION ---
    async adminSearchUsers(req, res) {
        if (!req.user?.admin) {
            await this.createLog(req, "adminSearchUsers", "users", 403, req.user?.user_id);
            return res.status(403).send({ message: "Forbidden" });
        }
        const query = req.query.q?.trim();
        if (!query) {
            await this.createLog(req, "adminSearchUsers", "users", 400, req.user.user_id);
            return this.sendError(res, 400, "Missing search query");
        }
        try {
            const users = await this.userService.adminSearchUsers(query);
            await this.createLog(req, "adminSearchUsers", "users", 200, req.user.user_id);
            res.send(users.map((user) => this.mapUserSearch(user)));
        }
        catch (error) {
            await this.createLog(req, "adminSearchUsers", "users", 500, req.user.user_id);
            this.sendError(res, 500, "Error searching users");
        }
    }
    async disableAccount(req, res) {
        const { userId } = req.params;
        const adminUserId = req.user?.user_id;
        if (!adminUserId) {
            await this.createLog(req, "disableAccount", "users", 401);
            return res.status(401).send({ message: "Unauthorized" });
        }
        if (adminUserId === userId) {
            await this.createLog(req, "disableAccount", "users", 400, adminUserId);
            return res.status(400).send({ message: "Vous ne pouvez pas désactiver votre propre compte." });
        }
        try {
            await this.userService.disableAccount(userId, adminUserId);
            await this.createLog(req, "disableAccount", "users", 200, adminUserId);
            res.status(200).send({ message: "Account disabled" });
        }
        catch (error) {
            await this.createLog(req, "disableAccount", "users", 403, adminUserId);
            res.status(403).send({
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async reenableAccount(req, res) {
        const { userId } = req.params;
        const adminUserId = req.user?.user_id;
        if (!adminUserId) {
            await this.createLog(req, "reenableAccount", "users", 401);
            return res.status(401).send({ message: "Unauthorized" });
        }
        if (adminUserId === userId) {
            await this.createLog(req, "reenableAccount", "users", 400, adminUserId);
            return res.status(400).send({ message: "Vous ne pouvez pas réactiver votre propre compte." });
        }
        try {
            await this.userService.reenableAccount(userId, adminUserId);
            await this.createLog(req, "reenableAccount", "users", 200, adminUserId);
            res.status(200).send({ message: "Account re-enabled" });
        }
        catch (error) {
            await this.createLog(req, "reenableAccount", "users", 403, adminUserId);
            res.status(403).send({
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async adminGetUser(req, res) {
        if (!req.user?.admin) {
            await this.createLog(req, "adminGetUser", "users", 403, req.user?.user_id);
            return res.status(403).send({ message: "Forbidden" });
        }
        try {
            await UserValidator_1.userIdParamValidator.validate(req.params);
        }
        catch (err) {
            await this.createLog(req, "adminGetUser", "users", 400, req.user?.user_id);
            return this.sendError(res, 400, "Invalid userId");
        }
        const { userId } = req.params;
        const userWithData = await this.userService.adminGetUserWithProfile(userId);
        if (!userWithData) {
            await this.createLog(req, "adminGetUser", "users", 404, req.user?.user_id);
            return this.sendError(res, 404, "User not found");
        }
        await this.createLog(req, "adminGetUser", "users", 200, req.user?.user_id);
        res.send({
            ...this.mapUserSearch(userWithData),
            disabled: userWithData.disabled,
            inventory: userWithData.inventory || [],
            ownedItems: userWithData.ownedItems || [],
            createdGames: userWithData.createdGames || [],
        });
    }
    // --- CRÉDITS ---
    async transferCredits(req, res) {
        const { targetUserId, amount } = req.body;
        if (!targetUserId || isNaN(amount) || amount <= 0) {
            await this.createLog(req, "transferCredits", "users", 400, req.user?.user_id);
            return this.sendError(res, 400, "Invalid input");
        }
        try {
            const sender = req.user;
            if (!sender) {
                await this.createLog(req, "transferCredits", "users", 401);
                return this.sendError(res, 401, "Unauthorized");
            }
            if (sender.user_id === targetUserId) {
                await this.createLog(req, "transferCredits", "users", 400, sender.user_id);
                return this.sendError(res, 400, "Cannot transfer credits to yourself");
            }
            const recipient = await this.userService.getUser(targetUserId);
            if (!recipient) {
                await this.createLog(req, "transferCredits", "users", 404, sender.user_id);
                return this.sendError(res, 404, "Recipient not found");
            }
            if (sender.balance < amount) {
                await this.createLog(req, "transferCredits", "users", 400, sender.user_id);
                return this.sendError(res, 400, "Insufficient balance");
            }
            await this.userService.updateUserBalance(sender.user_id, sender.balance - Number(amount));
            await this.userService.updateUserBalance(recipient.user_id, recipient.balance + Number(amount));
            await this.createLog(req, "transferCredits", "users", 200, sender.user_id);
            res.status(200).send({ message: "Credits transferred" });
        }
        catch (error) {
            await this.createLog(req, "transferCredits", "users", 500, req.user?.user_id);
            this.sendError(res, 500, "Error transferring credits");
        }
    }
    // --- VÉRIFICATION ---
    async checkVerificationKey(req, res) {
        const { userId, verificationKey } = req.body;
        if (!userId || !verificationKey) {
            await this.createLog(req, "checkVerificationKey", "users", 400);
            return this.sendError(res, 400, "Missing userId or verificationKey");
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            await this.createLog(req, "checkVerificationKey", "users", 404, userId);
            return this.sendError(res, 404, "User not found");
        }
        const expectedKey = (0, GenKey_1.genVerificationKey)(user.user_id);
        const isValid = verificationKey === expectedKey;
        await this.createLog(req, "checkVerificationKey", "users", isValid ? 200 : 401, userId);
        res.send({ success: isValid });
    }
    // --- RÔLES ---
    async changeRole(req, res) {
        const userId = req.originalUser?.user_id;
        const { role } = req.body;
        if (!userId) {
            await this.createLog(req, "changeRole", "users", 401);
            return this.sendError(res, 401, "Unauthorized");
        }
        if (!role || typeof role !== "string") {
            await this.createLog(req, "changeRole", "users", 400, userId);
            return this.sendError(res, 400, "Invalid role");
        }
        try {
            const studios = await this.studioService.getUserStudios(userId);
            const roles = [userId, ...studios.map((s) => s.user_id)];
            if (!roles.includes(role)) {
                await this.createLog(req, "changeRole", "users", 403, userId);
                return this.sendError(res, 403, "Forbidden: Invalid role");
            }
            res.cookie("role", role, {
                httpOnly: false,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                maxAge: 30 * 24 * 60 * 60 * 1000,
            });
            await this.createLog(req, "changeRole", "users", 200, userId);
            return res.status(200).send({ message: "Role updated successfully" });
        }
        catch (error) {
            await this.createLog(req, "changeRole", "users", 500, userId);
            this.sendError(res, 500, "Error setting role cookie");
        }
    }
    // Ajouter ces méthodes de vérification OAuth
    async verifyDiscordToken(accessToken) {
        try {
            const response = await fetch("https://discord.com/api/users/@me", {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (!response.ok) {
                throw new Error("Invalid Discord token");
            }
            const userData = await response.json();
            return {
                id: userData.id,
                email: userData.email,
                username: userData.username,
            };
        }
        catch (error) {
            throw new Error("Failed to verify Discord token");
        }
    }
    async verifyGoogleToken(accessToken) {
        try {
            const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
            if (!response.ok) {
                throw new Error("Invalid Google token");
            }
            const userData = await response.json();
            return {
                id: userData.id,
                email: userData.email,
                username: userData.name,
            };
        }
        catch (error) {
            throw new Error("Failed to verify Google token");
        }
    }
};
exports.Users = Users;
__decorate([
    (0, inversify_express_utils_1.httpPost)("/login-oauth"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "loginOAuth", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/register"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "register", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/login"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "login", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/@me",
        method: "GET",
        description: "Get the current authenticated user's profile, including studios, roles, inventory, owned items, and created games.",
        responseType: {
            userId: "string",
            username: "string",
            email: "string",
            verified: "boolean",
            studios: "array",
            roles: "array",
            inventory: "array",
            ownedItems: "array",
            createdGames: "array",
            verificationKey: "string",
        },
        example: "GET /api/users/@me",
    }),
    (0, inversify_express_utils_1.httpGet)("/@me", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "getMe", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/change-username", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "changeUsername", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/change-password", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "changePassword", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/forgot-password"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "forgotPassword", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/reset-password"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "resetPassword", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/validate-reset-token"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "isValidResetToken", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/steam-redirect"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "steamRedirect", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/steam-associate", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "steamAssociate", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/unlink-steam", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "unlinkSteam", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/search",
        method: "GET",
        description: "Search for users by username",
        query: { q: "The search query" },
        responseType: [
            {
                userId: "string",
                username: "string",
                verified: "boolean",
                steam_id: "string",
                steam_username: "string",
                steam_avatar_url: "string",
                isStudio: "boolean",
                admin: "boolean",
                inventory: "array",
                ownedItems: "array",
                createdGames: "array",
            },
        ],
        example: "GET /api/users/search?q=John",
    }),
    (0, inversify_express_utils_1.httpGet)("/search"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "searchUsers", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/:userId",
        method: "GET",
        description: "Get a user by userId, userId can be a Croissant ID, Discord ID, Google ID or Steam ID",
        params: { userId: "The id of the user" },
        responseType: {
            userId: "string",
            username: "string",
            verified: "boolean",
            steam_id: "string",
            steam_username: "string",
            steam_avatar_url: "string",
            isStudio: "boolean",
            admin: "boolean",
            inventory: "array",
            ownedItems: "array",
            createdGames: "array",
        },
        example: "GET /api/users/123",
    }),
    (0, inversify_express_utils_1.httpGet)("/:userId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "getUser", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/admin/search", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "adminSearchUsers", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/admin/disable/:userId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "disableAccount", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/admin/enable/:userId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "reenableAccount", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/admin/:userId", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "adminGetUser", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/transfer-credits",
        method: "POST",
        description: "Transfer credits from one user to another",
        body: {
            targetUserId: "The id of the recipient",
            amount: "The amount to transfer",
        },
        responseType: { message: "string" },
        example: "POST /api/users/transfer-credits { targetUserId: '456', amount: 50 }",
        requiresAuth: true,
    }),
    (0, inversify_express_utils_1.httpPost)("/transfer-credits", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "transferCredits", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/auth-verification",
        method: "POST",
        description: "Check the verification key for the user",
        responseType: { success: "boolean" },
        query: {
            userId: "The id of the user",
            verificationKey: "The verification key",
        },
        example: "POST /api/users/auth-verification?userId=123&verificationKey=abc123",
    }),
    (0, inversify_express_utils_1.httpPost)("/auth-verification"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "checkVerificationKey", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/change-role", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "changeRole", null);
exports.Users = Users = __decorate([
    (0, inversify_express_utils_1.controller)("/users"),
    __param(0, (0, inversify_1.inject)("UserService")),
    __param(1, (0, inversify_1.inject)("LogService")),
    __param(2, (0, inversify_1.inject)("MailService")),
    __param(3, (0, inversify_1.inject)("StudioService")),
    __param(4, (0, inversify_1.inject)("SteamOAuthService")),
    __metadata("design:paramtypes", [Object, Object, MailService_1.MailService,
        StudioService_1.StudioService,
        SteamOAuthService_1.SteamOAuthService])
], Users);
