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
const inversify_express_utils_1 = require("inversify-express-utils");
const UserValidator_1 = require("../validators/UserValidator");
const describe_1 = require("../decorators/describe");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const GenKey_1 = require("../utils/GenKey");
const SteamOAuthService_1 = require("../services/SteamOAuthService");
const MailService_1 = require("../services/MailService");
let Users = class Users {
    /**
     * Connexion via OAuth (Google/Discord)
     * Body attendu : { email, provider, providerId, username? }
     */
    async loginOAuth(req, res) {
        const { email, provider, providerId, username } = req.body;
        if (!email || !provider || !providerId) {
            return res.status(400).send({ message: "Missing email, provider or providerId" });
        }
        // Vérifie si l'utilisateur existe par email
        let user = await this.userService.findByEmail(email);
        if (!user) {
            // Création d'un nouvel utilisateur si non existant
            const userId = crypto.randomUUID();
            user = await this.userService.createUser(userId, username || "", email, null, provider, providerId);
            await this.mailService.sendAccountConfirmationMail(user.email);
        }
        else {
            // Si l'association n'existe pas, on l'ajoute
            if ((provider === "discord" && !user.discord_id) || (provider === "google" && !user.google_id)) {
                await this.userService.associateOAuth(user.user_id, provider, providerId);
            }
            // Vérifie que l'id provider correspond bien
            if ((provider === "discord" && user.discord_id && user.discord_id !== providerId) ||
                (provider === "google" && user.google_id && user.google_id !== providerId)) {
                return res.status(401).send({ message: "OAuth providerId mismatch" });
            }
        }
        if (user.disabled) {
            return res.status(403).send({ message: "Account is disabled" });
        }
        res.status(200).send({ message: "Login successful", user: { userId: user.user_id, username: user.username, email: user.email }, token: (0, GenKey_1.genKey)(user.user_id) });
    }
    constructor(userService, steamOAuthService, mailService) {
        this.userService = userService;
        this.steamOAuthService = steamOAuthService;
        this.mailService = mailService;
    }
    /**
 * Change le pseudo de l'utilisateur connecté
 * POST /users/change-username
 * Body: { username: string }
 * Requires authentication
 */
    async changeUsername(req, res) {
        const userId = req.user?.user_id;
        const { username } = req.body;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        if (!username || typeof username !== "string" || username.trim().length < 3) {
            return res.status(400).send({ message: "Invalid username (min 3 characters)" });
        }
        try {
            await this.userService.updateUser(userId, username.trim());
            res.status(200).send({ message: "Username updated" });
        }
        catch (error) {
            console.error("Error updating username", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error updating username", error: message });
        }
    }
    /**
     * Redirige l'utilisateur vers Steam pour l'authentification OpenID
     * GET /users/steam-redirect
     */
    async steamRedirect(req, res) {
        const url = this.steamOAuthService.getAuthUrl();
        res.send(url);
    }
    /**
     * Associe le compte Steam à l'utilisateur connecté
     * GET /users/steam-associate (callback Steam OpenID)
     * Query params: OpenID response
     * Requires authentication
     */
    async steamAssociate(req, res) {
        const token = req.headers["cookie"]?.toString().split("token=")[1]?.split(";")[0];
        const user = await this.userService.authenticateUser(token);
        if (!user) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            // Vérifie la réponse OpenID de Steam
            const steamId = await this.steamOAuthService.verifySteamOpenId(req.query);
            if (!steamId) {
                return res.status(400).send({ message: "Steam authentication failed" });
            }
            // Récupère le profil Steam
            const profile = await this.steamOAuthService.getSteamProfile(steamId);
            if (!profile) {
                return res.status(400).send({ message: "Unable to fetch Steam profile" });
            }
            // Met à jour l'utilisateur avec les infos Steam
            await this.userService.updateSteamFields(user.user_id, profile.steamid, profile.personaname, profile.avatarfull);
            // Redirige vers /settings (front-end route)
            res.send(`<html><head><meta http-equiv="refresh" content="0;url=/settings"></head><body>Redirecting to <a href="/settings">/settings</a>...</body></html>`);
        }
        catch (error) {
            console.error("Error associating Steam account", error);
            // const message = (error instanceof Error) ? error.message : String(error);
            // res.status(500).send({ message: "Error associating Steam account", error: message });
        }
    }
    /**
     * Dissocie le compte Steam de l'utilisateur connecté
     * POST /users/unlink-steam
     * Requires authentication
     */
    async unlinkSteam(req, res) {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            await this.userService.updateSteamFields(userId, null, null, null);
            res.status(200).send({ message: "Steam account unlinked" });
        }
        catch (error) {
            console.error("Error unlinking Steam account", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error unlinking Steam account", error: message });
        }
    }
    /**
     * GET /users/getUserBySteamId?steamId=xxx
     * Récupère un utilisateur par son Steam ID
     */
    async getUserBySteamId(req, res) {
        const steamId = req.query.steamId;
        if (!steamId) {
            return res.status(400).send({ message: "Missing steamId query parameter" });
        }
        try {
            const user = await this.userService.getUserBySteamId(steamId);
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }
            // const discordUser = await this.userService.getDiscordUser(user.user_id);
            const filteredUser = {
                // ...discordUser,
                id: user.user_id,
                userId: user.user_id,
                balance: Math.floor(user.balance),
                verified: user.verified,
                username: user.username,
                steam_id: user.steam_id,
                steam_username: user.steam_username,
                steam_avatar_url: user.steam_avatar_url
            };
            res.send(filteredUser);
        }
        catch (error) {
            console.error("Error fetching user by Steam ID", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user by Steam ID", error: message });
        }
    }
    async getMe(req, res) {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        // Filter user to only expose allowed fields
        // const discordUser = await this.userService.getDiscordUser(user.user_id)
        const filteredUser = {
            // ...discordUser,
            id: user.user_id,
            userId: user.user_id,
            email: user.email,
            balance: Math.floor(user.balance),
            verified: user.verified,
            username: user.username,
            verificationKey: (0, GenKey_1.genVerificationKey)(user.user_id),
            steam_id: user.steam_id,
            steam_username: user.steam_username,
            steam_avatar_url: user.steam_avatar_url
        };
        if (user.admin) {
            filteredUser.admin = user.admin;
        }
        res.send(filteredUser);
    }
    async searchUsers(req, res) {
        const query = req.query.q?.trim();
        if (!query) {
            return res.status(400).send({ message: "Missing search query" });
        }
        try {
            const users = await this.userService.searchUsersByUsername(query);
            const filtered = [];
            for (const user of users) {
                // const discordUser = await this.userService.getDiscordUser(user.user_id);
                filtered.push({
                    // ...discordUser,
                    id: user.user_id,
                    userId: user.user_id,
                    username: user.username,
                    balance: Math.floor(user.balance),
                    verified: user.verified,
                    steam_id: user.steam_id,
                    steam_username: user.steam_username,
                    steam_avatar_url: user.steam_avatar_url
                });
            }
            res.send(filtered);
        }
        catch (error) {
            console.error("Error searching users", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error searching users", error: message });
        }
    }
    async adminSearchUsers(req, res) {
        const query = req.query.q?.trim();
        if (!query) {
            return res.status(400).send({ message: "Missing search query" });
        }
        try {
            const users = await this.userService.adminSearchUsers(query);
            const filtered = [];
            for (const user of users) {
                // const discordUser = await this.userService.getDiscordUser(user.user_id);
                filtered.push({
                    // ...discordUser,
                    id: user.user_id,
                    userId: user.user_id,
                    username: user.username,
                    balance: Math.floor(user.balance),
                    verified: user.verified,
                    steam_id: user.steam_id,
                    steam_username: user.steam_username,
                    steam_avatar_url: user.steam_avatar_url
                });
            }
            res.send(filtered);
        }
        catch (error) {
            console.error("Error searching users", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error searching users", error: message });
        }
    }
    async disableAccount(req, res) {
        const { userId } = req.params;
        const adminUserId = req.user?.user_id;
        if (!adminUserId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            await this.userService.disableAccount(userId, adminUserId);
            res.status(200).send({ message: "Account disabled" });
        }
        catch (error) {
            res.status(403).send({ message: error instanceof Error ? error.message : String(error) });
        }
    }
    async reenableAccount(req, res) {
        const { userId } = req.params;
        const adminUserId = req.user?.user_id;
        if (!adminUserId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            await this.userService.reenableAccount(userId, adminUserId);
            res.status(200).send({ message: "Account re-enabled" });
        }
        catch (error) {
            res.status(403).send({ message: error instanceof Error ? error.message : String(error) });
        }
    }
    async adminGetUser(req, res) {
        try {
            await UserValidator_1.userIdParamValidator.validate(req.params);
        }
        catch (err) {
            return res.status(400).send({ message: "Invalid userId", error: err });
        }
        const { userId } = req.params;
        const user = await this.userService.adminGetUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        // Filter user to only expose allowed fields
        // const discordUser = await this.userService.getDiscordUser(user.user_id);
        const filteredUser = {
            // ...discordUser,
            id: user.user_id,
            userId: user.user_id,
            balance: Math.floor(user.balance),
            verified: user.verified,
            username: user.username,
            disabled: !!user.disabled,
        };
        if (user.admin) {
            filteredUser.admin = user.admin;
        }
        res.send(filteredUser);
    }
    async checkVerificationKey(req, res) {
        const { userId, verificationKey } = req.body;
        if (!userId || !verificationKey) {
            return res.status(400).send({ message: "Missing userId or verificationKey" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        const expectedKey = (0, GenKey_1.genVerificationKey)(user.user_id);
        res.send({ success: verificationKey === expectedKey });
    }
    async isValidResetToken(req, res) {
        const { reset_token } = req.query;
        if (!reset_token) {
            return res.status(400).send({ message: "Missing required fields" });
        }
        const users = await this.userService.getAllUsersWithDisabled();
        const user = users.find(u => u.forgot_password_token === reset_token);
        if (!user) {
            return res.status(404).send({ message: "Invalid reset token" });
        }
        res.status(200).send({ message: "Valid reset token", user });
    }
    async getUser(req, res) {
        try {
            await UserValidator_1.userIdParamValidator.validate(req.params);
        }
        catch (err) {
            return res.status(400).send({ message: "Invalid userId", error: err });
        }
        const { userId } = req.params;
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        // Filter user to only expose allowed fields
        // const discordUser = await this.userService.getDiscordUser(user.user_id)
        const filteredUser = {
            // ...discordUser,
            id: user.user_id,
            userId: user.user_id,
            balance: Math.floor(user.balance),
            username: user.username,
            steam_id: user.steam_id,
            steam_username: user.steam_username,
            steam_avatar_url: user.steam_avatar_url,
            verified: user.verified
        };
        res.send(filteredUser);
    }
    async register(req, res) {
        const { username, email, password, provider, providerId } = req.body;
        let { userId } = req.body;
        if (!username || !email || (!password && !provider)) {
            return res.status(400).send({ message: "Missing required fields" });
        }
        if (!userId) {
            userId = crypto.randomUUID();
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).send({ message: "Invalid email address" });
        }
        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcryptjs_1.default.hash(password, 10);
        }
        try {
            // Crée ou associe l'utilisateur selon l'email et provider
            const user = await this.userService.createUser(userId, username, email, hashedPassword, provider, providerId);
            await this.mailService.sendAccountConfirmationMail(user.email);
            res.status(201).send({ message: "User registered", token: (0, GenKey_1.genKey)(user.user_id) });
        }
        catch (error) {
            console.error("Error registering user", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error registering user", error: message });
        }
    }
    async login(req, res) {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).send({ message: "Missing email or password" });
        }
        const allUsers = await this.userService.getAllUsersWithDisabled();
        const user = allUsers.find(u => u.email === email);
        if (!user || !user.password) {
            return res.status(401).send({ message: "Invalid credentials" });
        }
        // bcrypt importé en haut
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid) {
            return res.status(401).send({ message: "Invalid credentials" });
        }
        // Check si le compte est désactivé
        if (user.disabled) {
            return res.status(403).send({ message: "Account is disabled" });
        }
        this.mailService.sendConnectionNotificationMail(user.email, user.username).catch(err => {
            console.error("Error sending connection notification email", err);
        });
        res.status(200).send({ message: "Login successful", user: { userId: user.user_id, username: user.username, email: user.email }, token: (0, GenKey_1.genKey)(user.user_id) });
    }
    async changePassword(req, res) {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        if (!newPassword || !confirmPassword) {
            return res.status(400).send({ message: "Missing newPassword or confirmPassword" });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).send({ message: "New password and confirm password do not match" });
        }
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        let valid = true;
        if (user.password) {
            valid = await bcryptjs_1.default.compare(oldPassword, user.password);
        }
        if (!valid) {
            return res.status(401).send({ message: "Invalid current password" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        try {
            await this.userService.updateUserPassword(userId, hashedPassword);
            res.status(200).send({ message: "Password changed successfully" });
        }
        catch (error) {
            console.error("Error changing password", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error changing password", error: message });
        }
    }
    async transferCredits(req, res) {
        const { targetUserId, amount } = req.body;
        if (!targetUserId || isNaN(amount) || amount <= 0) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const sender = req.user;
            if (!sender) {
                return res.status(401).send({ message: "Unauthorized" });
            }
            if (sender.user_id === targetUserId) {
                return res.status(400).send({ message: "Cannot transfer credits to yourself" });
            }
            const recipient = await this.userService.getUser(targetUserId);
            if (!recipient) {
                return res.status(404).send({ message: "Recipient not found" });
            }
            if (sender.balance < amount) {
                return res.status(400).send({ message: "Insufficient balance" });
            }
            await this.userService.updateUserBalance(sender.user_id, sender.balance - Number(amount));
            await this.userService.updateUserBalance(recipient.user_id, recipient.balance + Number(amount));
            res.status(200).send({ message: "Credits transferred" });
        }
        catch (error) {
            console.error("Error transferring credits", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error transferring credits", error: message });
        }
    }
    async forgotPassword(req, res) {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send({ message: "Email is required" });
        }
        const user = await this.userService.findByEmail(email);
        if (!user) {
            return res.status(404).send({ message: "Invalid email" });
        }
        // Here you would typically generate a password reset token and send it via email
        const passwordResetToken = await this.userService.generatePasswordResetToken(email);
        await this.mailService.sendPasswordResetMail(email, passwordResetToken);
        res.status(200).send({ message: "Password reset email sent" });
    }
    async resetPassword(req, res) {
        const { new_password, confirm_password, reset_token } = req.body;
        if (!new_password || !reset_token || !confirm_password) {
            return res.status(400).send({ message: "Missing required fields" });
        }
        if (new_password !== confirm_password) {
            return res.status(400).send({ message: "New password and confirm password do not match" });
        }
        const allUsers = await this.userService.getAllUsersWithDisabled();
        const user = allUsers.find(u => u.forgot_password_token === reset_token);
        if (!user) {
            return res.status(404).send({ message: "Invalid user" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(new_password, 10);
        try {
            await this.userService.updateUserPassword(user.user_id, hashedPassword);
            res.status(200).send({ message: "Password reset successfully", token: (0, GenKey_1.genKey)(user.user_id) });
        }
        catch (error) {
            console.error("Error resetting password", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error resetting password", error: message });
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpPost)("/login-oauth"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "loginOAuth", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/change-username", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "changeUsername", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/steam-redirect"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "steamRedirect", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/steam-associate"),
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
        endpoint: "/users/getUserBySteamId",
        method: "GET",
        description: "Get a user by their Steam ID",
        query: { steamId: "The Steam ID of the user" },
        responseType: { userId: "string", balance: "number", username: "string", steam_id: "string", steam_username: "string", steam_avatar_url: "string" },
        example: "GET /api/users/getUserBySteamId?steamId=1234567890"
    }),
    (0, inversify_express_utils_1.httpGet)("/getUserBySteamId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "getUserBySteamId", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/@me",
        method: "GET",
        description: "Get the authenticated user's information",
        responseType: { userId: "string", balance: "number", username: "string" },
        example: "GET /api/users/@me",
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpGet)("/@me", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "getMe", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/search",
        method: "GET",
        description: "Search for users by username",
        query: { q: "The search query" },
        responseType: [{ userId: "string", balance: "number", username: "string" }],
        example: "GET /api/users/search?q=John",
    }),
    (0, inversify_express_utils_1.httpGet)("/search"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "searchUsers", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/admin/search"),
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
    (0, inversify_express_utils_1.httpGet)("/admin/:userId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "adminGetUser", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/auth-verification",
        method: "POST",
        description: "Check the verification key for the user",
        responseType: { success: "boolean" },
        query: { userId: "The id of the user", verificationKey: "The verification key" },
        example: "POST /api/users/auth-verification?userId=123&verificationKey=abc123"
    }),
    (0, inversify_express_utils_1.httpPost)("/auth-verification"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "checkVerificationKey", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/validate-reset-token"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "isValidResetToken", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/:userId",
        method: "GET",
        description: "Get a user by userId",
        params: { userId: "The id of the user" },
        responseType: { userId: "string", balance: "number", username: "string" },
        example: "GET /api/users/123"
    }),
    (0, inversify_express_utils_1.httpGet)("/:userId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "getUser", null);
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
    (0, inversify_express_utils_1.httpPost)("/change-password", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "changePassword", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/transfer-credits",
        method: "POST",
        description: "Transfer credits from one user to another",
        body: { targetUserId: "The id of the recipient", amount: "The amount to transfer" },
        responseType: { message: "string" },
        example: "POST /api/users/transfer-credits { targetUserId: '456', amount: 50 }",
        requiresAuth: true
    }),
    (0, inversify_express_utils_1.httpPost)("/transfer-credits", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "transferCredits", null);
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
Users = __decorate([
    (0, inversify_express_utils_1.controller)("/users"),
    __param(0, (0, inversify_1.inject)("UserService")),
    __param(1, (0, inversify_1.inject)("SteamOAuthService")),
    __param(2, (0, inversify_1.inject)("MailService")),
    __metadata("design:paramtypes", [Object, SteamOAuthService_1.SteamOAuthService,
        MailService_1.MailService])
], Users);
exports.Users = Users;
