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
var UserService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const inversify_1 = require("inversify");
const UserCache_1 = require("../utils/UserCache");
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const GenKey_1 = require("../utils/GenKey");
(0, dotenv_1.config)({ path: path_1.default.join(__dirname, "..", "..", ".env") });
const BOT_TOKEN = process.env.BOT_TOKEN;
let UserService = UserService_1 = class UserService {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    // --- Helpers privés ---
    /**
     * Helper pour générer la clause WHERE pour les IDs (user_id, discord_id, google_id, steam_id)
     */
    static getIdWhereClause(includeDisabled = false) {
        const base = "(user_id = ? OR discord_id = ? OR google_id = ? OR steam_id = ?)";
        if (includeDisabled)
            return base;
        return base + " AND (disabled = 0 OR disabled IS NULL)";
    }
    /**
     * Helper pour récupérer un utilisateur par n'importe quel ID
     */
    async fetchUserByAnyId(user_id, includeDisabled = false) {
        const users = await this.databaseService.read(`SELECT * FROM users WHERE ${UserService_1.getIdWhereClause(includeDisabled)}`, [user_id, user_id, user_id, user_id]);
        return users.length > 0 ? users[0] : null;
    }
    /**
     * Helper pour faire un SELECT * FROM users avec option disabled
     */
    async fetchAllUsers(includeDisabled = false) {
        if (includeDisabled) {
            return await this.databaseService.read("SELECT * FROM users");
        }
        return await this.databaseService.read("SELECT * FROM users WHERE (disabled = 0 OR disabled IS NULL)");
    }
    /**
     * Helper pour faire un UPDATE users sur un ou plusieurs champs
     */
    async updateUserFields(user_id, fields) {
        const updates = [];
        const params = [];
        if (fields.username !== undefined) {
            updates.push("username = ?");
            params.push(fields.username);
        }
        if (fields.balance !== undefined) {
            updates.push("balance = ?");
            params.push(fields.balance);
        }
        if (fields.password !== undefined) {
            updates.push("password = ?");
            params.push(fields.password);
        }
        if (updates.length === 0)
            return;
        params.push(user_id);
        await this.databaseService.update(`UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`, params);
    }
    /**
     * Met à jour les champs Steam de l'utilisateur
     */
    async updateSteamFields(user_id, steam_id, steam_username, steam_avatar_url) {
        await this.databaseService.update("UPDATE users SET steam_id = ?, steam_username = ?, steam_avatar_url = ? WHERE user_id = ?", [steam_id, steam_username, steam_avatar_url, user_id]);
    }
    /**
     * Trouve un utilisateur par email (email unique)
     */
    async findByEmail(email) {
        const users = await this.databaseService.read("SELECT * FROM users WHERE email = ?", [email]);
        return users.length > 0 ? users[0] : null;
    }
    /**
     * Associe un identifiant OAuth (discord ou google) à un utilisateur existant
     */
    async associateOAuth(user_id, provider, providerId) {
        const column = provider === "discord" ? "discord_id" : "google_id";
        await this.databaseService.update(`UPDATE users SET ${column} = ? WHERE user_id = ?`, [providerId, user_id]);
    }
    async disableAccount(targetUserId, adminUserId) {
        // Check if adminUserId is admin
        const admin = await this.adminGetUser(adminUserId);
        if (!admin || !admin.admin) {
            throw new Error("Unauthorized: not admin");
        }
        await this.databaseService.update("UPDATE users SET disabled = 1 WHERE user_id = ?", [targetUserId]);
    }
    async reenableAccount(targetUserId, adminUserId) {
        // Check if adminUserId is admin
        const admin = await this.adminGetUser(adminUserId);
        if (!admin || !admin.admin) {
            throw new Error("Unauthorized: not admin");
        }
        await this.databaseService.update("UPDATE users SET disabled = 0 WHERE user_id = ?", [targetUserId]);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getDiscordUser(userId) {
        try {
            const cached = (0, UserCache_1.getCachedUser)(userId);
            if (cached) {
                return cached;
            }
            const headers = {};
            if (BOT_TOKEN) {
                headers["Authorization"] = "Bot " + BOT_TOKEN;
            }
            const response = await fetch(`https://discord.com/api/v10/users/${userId}`, {
                headers,
            });
            if (!response.ok) {
                return null;
            }
            const user = await response.json();
            (0, UserCache_1.setCachedUser)(userId, user);
            return user;
        }
        catch (error) {
            console.error("Error fetching Discord user:", error);
            return null;
        }
    }
    async searchUsersByUsername(query) {
        const users = await this.databaseService.read("SELECT * FROM users WHERE username LIKE ? AND (disabled = 0 OR disabled IS NULL)", [`%${query}%`]);
        return users;
    }
    /**
     * Crée un utilisateur, ou associe un compte OAuth si l'email existe déjà
     * Si providerId et provider sont fournis, associe l'OAuth à l'utilisateur existant
     */
    async createUser(user_id, username, email, password, provider, providerId) {
        // Vérifie si l'utilisateur existe déjà par email
        const existing = await this.findByEmail(email);
        if (existing) {
            // Si provider info, associe l'OAuth
            if (provider && providerId) {
                await this.associateOAuth(existing.user_id, provider, providerId);
            }
            return existing;
        }
        // Création du nouvel utilisateur
        await this.databaseService.create("INSERT INTO users (user_id, username, email, password, balance, discord_id, google_id) VALUES (?, ?, ?, ?, 0, ?, ?)", [
            user_id,
            username,
            email,
            password,
            provider === "discord" ? providerId : null,
            provider === "google" ? providerId : null,
        ]);
        return (await this.getUser(user_id));
    }
    async createBrandUser(user_id, username) {
        // Crée un utilisateur de marque sans email ni mot de passe
        await this.databaseService.create("INSERT INTO users (user_id, username, email, balance, isStudio) VALUES (?, ?, ?, 0, 1)", [user_id, username, ""]);
        return (await this.getUser(user_id));
    }
    async getUser(user_id) {
        return this.fetchUserByAnyId(user_id, false);
    }
    async adminGetUser(user_id) {
        return this.fetchUserByAnyId(user_id, true);
    }
    async adminSearchUsers(query) {
        const users = await this.databaseService.read("SELECT * FROM users WHERE username LIKE ?", [`%${query}%`]);
        return users;
    }
    async getAllUsers() {
        return this.fetchAllUsers(false);
    }
    async getAllUsersWithDisabled() {
        return this.fetchAllUsers(true);
    }
    async updateUser(user_id, username, balance) {
        await this.updateUserFields(user_id, { username, balance });
    }
    async updateUserBalance(user_id, balance) {
        await this.updateUserFields(user_id, { balance });
    }
    async updateUserPassword(user_id, hashedPassword) {
        await this.updateUserFields(user_id, { password: hashedPassword });
    }
    /**
     * Récupère un utilisateur par son Steam ID
     */
    async getUserBySteamId(steamId) {
        const users = await this.databaseService.read("SELECT * FROM users WHERE steam_id = ? AND (disabled = 0 OR disabled IS NULL)", [steamId]);
        return users.length > 0 ? users[0] : null;
    }
    async generatePasswordResetToken(email) {
        const token = crypto_1.default.randomBytes(32).toString("hex");
        await this.databaseService.update("UPDATE users SET forgot_password_token = ? WHERE email = ?", [token, email]);
        return token;
    }
    async deleteUser(user_id) {
        await this.databaseService.delete("DELETE FROM users WHERE user_id = ?", [
            user_id,
        ]);
    }
    async authenticateUser(api_key) {
        const users = await this.getAllUsersWithDisabled();
        if (!users) {
            console.error("Error fetching users", users);
            return null;
        }
        const user = users.find((user) => (0, GenKey_1.genKey)(user.user_id) === api_key) || null;
        if (!user) {
            return null;
        }
        return user;
    }
    async updateWebauthnChallenge(user_id, challenge) {
        await this.databaseService.update("UPDATE users SET webauthn_challenge = ? WHERE user_id = ?", [challenge, user_id]);
    }
    async addWebauthnCredential(userId, credential) {
        const existing = await this.getUser(userId);
        if (!existing) {
            throw new Error("User not found");
        }
        const credentials = JSON.parse(existing.webauthn_credentials || "[]");
        credentials.push({
            id: credential.id,
            name: credential.name,
            created_at: credential.created_at,
        });
        await this.databaseService.update("UPDATE users SET webauthn_credentials = ? WHERE user_id = ?", [JSON.stringify(credentials), userId]);
    }
    async getUserByCredentialId(credentialId) {
        const users = await this.databaseService.read("SELECT * FROM users WHERE webauthn_credentials LIKE ? AND (disabled = 0 OR disabled IS NULL)", [`%${credentialId}%`]);
        return users.length > 0 ? users[0] : null;
    }
};
UserService = UserService_1 = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], UserService);
exports.UserService = UserService;
