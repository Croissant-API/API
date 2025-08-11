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
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const GenKey_1 = require("../utils/GenKey");
const diacritics_1 = __importDefault(require("diacritics"));
const Jwt_1 = require("../utils/Jwt");
function slugify(str) {
    str = str.normalize("NFKD");
    str = diacritics_1.default.remove(str);
    const substitutions = {
        α: "a",
        β: "b",
        γ: "g",
        δ: "d",
        ε: "e",
        θ: "o",
        λ: "l",
        μ: "m",
        ν: "v",
        π: "p",
        ρ: "r",
        σ: "s",
        τ: "t",
        φ: "f",
        χ: "x",
        ψ: "ps",
        ω: "w",
        ℓ: "l",
        "𝓁": "l",
        "𝔩": "l",
    };
    str = str
        .split("")
        .map((c) => substitutions[c] ?? c)
        .join("");
    str = str.replace(/[^a-zA-Z0-9]/g, "");
    return str.toLowerCase();
}
(0, dotenv_1.config)({ path: path_1.default.join(__dirname, "..", "..", ".env") });
let UserService = UserService_1 = class UserService {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    static getIdWhereClause(includeDisabled = false) {
        const base = "(user_id = ? OR discord_id = ? OR google_id = ? OR steam_id = ?)";
        if (includeDisabled)
            return base;
        return base + " AND (disabled = 0 OR disabled IS NULL)";
    }
    async fetchUserByAnyId(user_id, includeDisabled = false) {
        // console.log("Fetching user by any ID:", user_id);
        if (!user_id)
            return null;
        const users = await this.databaseService.read(`SELECT * FROM users WHERE ${UserService_1.getIdWhereClause(includeDisabled)}`, [user_id, user_id, user_id, user_id]);
        return users.length > 0 ? users[0] : null;
    }
    async fetchAllUsers(includeDisabled = false) {
        if (includeDisabled) {
            return await this.databaseService.read("SELECT * FROM users");
        }
        return await this.databaseService.read("SELECT * FROM users WHERE (disabled = 0 OR disabled IS NULL)");
    }
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
        await this.databaseService.request(`UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`, params);
    }
    async updateSteamFields(user_id, steam_id, steam_username, steam_avatar_url) {
        await this.databaseService.request("UPDATE users SET steam_id = ?, steam_username = ?, steam_avatar_url = ? WHERE user_id = ?", [steam_id, steam_username, steam_avatar_url, user_id]);
    }
    async findByEmail(email) {
        const users = await this.databaseService.read("SELECT * FROM users WHERE email = ?", [email]);
        return users.length > 0 ? users[0] : null;
    }
    async associateOAuth(user_id, provider, providerId) {
        const column = provider === "discord" ? "discord_id" : "google_id";
        await this.databaseService.request(`UPDATE users SET ${column} = ? WHERE user_id = ?`, [providerId, user_id]);
    }
    async disableAccount(targetUserId, adminUserId) {
        const admin = await this.adminGetUser(adminUserId);
        if (!admin || !admin.admin) {
            throw new Error("Unauthorized: not admin");
        }
        await this.databaseService.request("UPDATE users SET disabled = 1 WHERE user_id = ?", [targetUserId]);
    }
    async reenableAccount(targetUserId, adminUserId) {
        const admin = await this.adminGetUser(adminUserId);
        if (!admin || !admin.admin) {
            throw new Error("Unauthorized: not admin");
        }
        await this.databaseService.request("UPDATE users SET disabled = 0 WHERE user_id = ?", [targetUserId]);
    }
    async searchUsersByUsername(query) {
        const users = await this.databaseService.read(`SELECT user_id, username, verified, isStudio, admin, badges, beta_user FROM users WHERE (disabled = 0 OR disabled IS NULL)`);
        const querySlug = slugify(query);
        const matchedUsers = users.filter((u) => {
            return slugify(u.username).indexOf(querySlug) !== -1;
        });
        return matchedUsers.map((u) => ({
            user_id: u.user_id,
            username: u.username,
            verified: !!u.verified,
            isStudio: !!u.isStudio,
            admin: !!u.admin,
            beta_user: !!u.beta_user,
            badges: u.beta_user ? ["early_user", ...u.badges] : u.badges || [],
        }));
    }
    async createUser(user_id, username, email, password, provider, providerId) {
        const existing = await this.findByEmail(email);
        if (existing) {
            if (provider && providerId) {
                await this.associateOAuth(existing.user_id, provider, providerId);
            }
            return existing;
        }
        await this.databaseService.request("INSERT INTO users (user_id, username, email, password, balance, discord_id, google_id) VALUES (?, ?, ?, ?, 0, ?, ?)", [
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
        await this.databaseService.request("INSERT INTO users (user_id, username, email, balance, isStudio) VALUES (?, ?, ?, 0, 1)", [user_id, username, ""]);
        return (await this.getUser(user_id));
    }
    async getUser(user_id) {
        return this.fetchUserByAnyId(user_id, false);
    }
    async adminGetUser(user_id) {
        return this.fetchUserByAnyId(user_id, true);
    }
    async adminSearchUsers(query) {
        const users = await this.databaseService.read(`SELECT user_id, username, verified, isStudio, admin, badges, beta_user, disabled FROM users`);
        const querySlug = slugify(query);
        const matchedUsers = users.filter((u) => {
            return slugify(u.username).indexOf(querySlug) !== -1;
        });
        return matchedUsers.map((u) => ({
            user_id: u.user_id,
            username: u.username,
            verified: !!u.verified,
            isStudio: !!u.isStudio,
            admin: !!u.admin,
            beta_user: !!u.beta_user,
            badges: u.beta_user ? ["early_user", ...u.badges] : u.badges || [],
            disabled: !!u.disabled,
        }));
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
    async getUserBySteamId(steamId) {
        const users = await this.databaseService.read("SELECT * FROM users WHERE steam_id = ? AND (disabled = 0 OR disabled IS NULL)", [steamId]);
        return users.length > 0 ? users[0] : null;
    }
    async generatePasswordResetToken(email) {
        const token = crypto_1.default.randomBytes(32).toString("hex");
        await this.databaseService.request("UPDATE users SET forgot_password_token = ? WHERE email = ?", [token, email]);
        return token;
    }
    async deleteUser(user_id) {
        await this.databaseService.request("DELETE FROM users WHERE user_id = ?", [user_id]);
    }
    async authenticateUser(tokenOrApiKey) {
        // Essaye de décoder comme JWT
        const jwtPayload = (0, Jwt_1.verifyUserJwt)(tokenOrApiKey);
        let apiKey = tokenOrApiKey;
        if (jwtPayload && jwtPayload.apiKey) {
            apiKey = jwtPayload.apiKey;
        }
        // Recherche l'utilisateur par apiKey (clé API)
        const users = await this.getAllUsersWithDisabled();
        if (!users) {
            console.error("Error fetching users", users);
            return null;
        }
        const user = users.find((user) => (0, GenKey_1.genKey)(user.user_id) === apiKey) || null;
        if (!user) {
            return null;
        }
        return user;
    }
    async updateWebauthnChallenge(user_id, challenge) {
        await this.databaseService.request("UPDATE users SET webauthn_challenge = ? WHERE user_id = ?", [challenge, user_id]);
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
        await this.databaseService.request("UPDATE users SET webauthn_credentials = ? WHERE user_id = ?", [JSON.stringify(credentials), userId]);
    }
    async getUserByCredentialId(credentialId) {
        const users = await this.databaseService.read("SELECT * FROM users WHERE webauthn_credentials LIKE ? AND (disabled = 0 OR disabled IS NULL)", [`%${credentialId}%`]);
        return users.length > 0 ? users[0] : null;
    }
    async setAuthenticatorSecret(userId, secret) {
        return this.databaseService.request("UPDATE users SET authenticator_secret = ? WHERE user_id = ?", [secret, userId]);
    }
    async getAuthenticatorSecret(userId) {
        const user = await this.getUser(userId);
        return user ? user.authenticator_secret || null : null;
    }
    async getUserWithCompleteProfile(user_id) {
        const query = `
      SELECT 
        u.*,
        CONCAT('[', GROUP_CONCAT(
          CASE WHEN inv.item_id IS NOT NULL AND i.itemId IS NOT NULL THEN
            JSON_OBJECT(
              'user_id', inv.user_id,
              'item_id', inv.item_id,
              'itemId', i.itemId,
              'name', i.name,
              'description', i.description,
              'amount', inv.amount,
              'iconHash', i.iconHash,
              'sellable', IF(inv.sellable = 1, 1, 0),
              'purchasePrice', inv.purchasePrice,
              'rarity', inv.rarity,
              'custom_url_link', inv.custom_url_link,
              'metadata', inv.metadata
            )
          END
        ), ']') as inventory,
        (SELECT CONCAT('[', GROUP_CONCAT(
          JSON_OBJECT(
            'itemId', oi.itemId,
            'name', oi.name,
            'description', oi.description,
            'owner', oi.owner,
            'price', oi.price,
            'iconHash', oi.iconHash,
            'showInStore', oi.showInStore
          )
        ), ']') FROM items oi WHERE oi.owner = u.user_id AND (oi.deleted IS NULL OR oi.deleted = 0) AND oi.showInStore = 1 ORDER BY oi.name) as ownedItems,
        (SELECT CONCAT('[', GROUP_CONCAT(
          JSON_OBJECT(
            'gameId', g.gameId,
            'name', g.name,
            'description', g.description,
            'price', g.price,
            'owner_id', g.owner_id,
            'showInStore', g.showInStore,
            'iconHash', g.iconHash,
            'splashHash', g.splashHash,
            'bannerHash', g.bannerHash,
            'genre', g.genre,
            'release_date', g.release_date,
            'developer', g.developer,
            'publisher', g.publisher,
            'platforms', g.platforms,
            'rating', g.rating,
            'website', g.website,
            'trailer_link', g.trailer_link,
            'multiplayer', g.multiplayer,
            'download_link', g.download_link
          )
        ), ']') FROM games g WHERE g.owner_id = u.user_id AND g.showInStore = 1 ORDER BY g.name) as createdGames
      FROM users u
      LEFT JOIN inventories inv ON u.user_id = inv.user_id AND inv.amount > 0
      LEFT JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
      WHERE (u.user_id = ? OR u.discord_id = ? OR u.google_id = ? OR u.steam_id = ?) AND (u.disabled = 0 OR u.disabled IS NULL)
      GROUP BY u.user_id
    `;
        await this.databaseService.request(`DELETE FROM inventories 
       WHERE user_id = (
         SELECT user_id FROM users 
         WHERE user_id = ?
           OR discord_id = ?
           OR google_id = ?
           OR steam_id = ?
       ) 
       AND item_id NOT IN (
         SELECT itemId FROM items WHERE deleted IS NULL OR deleted = 0
       )`, [user_id, user_id, user_id, user_id]);
        const results = await this.databaseService.read(query, [user_id, user_id, user_id, user_id]);
        if (results.length === 0)
            return null;
        const user = results[0];
        if (user.beta_user) {
            user.badges = ["early_user", ...user.badges];
        }
        if (user.inventory) {
            user.inventory = user.inventory
                .filter((item) => item !== null)
                .map((item) => ({
                ...item,
                metadata: typeof item.metadata === "string" && item.metadata
                    ? (() => {
                        try {
                            return JSON.parse(item.metadata);
                        }
                        catch {
                            return item.metadata;
                        }
                    })()
                    : item.metadata,
            }))
                .sort((a, b) => {
                const nameCompare = a.name?.localeCompare(b.name || "") || 0;
                if (nameCompare !== 0)
                    return nameCompare;
                if (!a.metadata && b.metadata)
                    return -1;
                if (a.metadata && !b.metadata)
                    return 1;
                return 0;
            });
        }
        return user;
    }
    async getUserWithPublicProfile(user_id) {
        const query = `
      SELECT 
        u.user_id, u.username, u.verified, u.isStudio, u.admin, u.beta_user, u.badges,
        CONCAT('[', GROUP_CONCAT(
          CASE WHEN inv.item_id IS NOT NULL AND i.itemId IS NOT NULL THEN
            JSON_OBJECT(
              'user_id', inv.user_id,
              'item_id', inv.item_id,
              'itemId', i.itemId,
              'name', i.name,
              'description', i.description,
              'amount', inv.amount,
              'iconHash', i.iconHash,
              'sellable', IF(inv.sellable = 1, 1, 0),
              'purchasePrice', inv.purchasePrice,
              'rarity', inv.rarity,
              'custom_url_link', inv.custom_url_link,
              'metadata', inv.metadata
            )
          END
        ), ']') as inventory,
        (SELECT CONCAT('[', GROUP_CONCAT(
          JSON_OBJECT(
            'itemId', oi.itemId,
            'name', oi.name,
            'description', oi.description,
            'owner', oi.owner,
            'price', oi.price,
            'iconHash', oi.iconHash,
            'showInStore', oi.showInStore
          )
        ), ']') FROM items oi WHERE oi.owner = u.user_id AND (oi.deleted IS NULL OR oi.deleted = 0) AND oi.showInStore = 1 ORDER BY oi.name) as ownedItems,
        (SELECT CONCAT('[', GROUP_CONCAT(
          JSON_OBJECT(
            'gameId', g.gameId,
            'name', g.name,
            'description', g.description,
            'price', g.price,
            'owner_id', g.owner_id,
            'showInStore', g.showInStore,
            'iconHash', g.iconHash,
            'splashHash', g.splashHash,
            'bannerHash', g.bannerHash,
            'genre', g.genre,
            'release_date', g.release_date,
            'developer', g.developer,
            'publisher', g.publisher,
            'platforms', g.platforms,
            'rating', g.rating,
            'website', g.website,
            'trailer_link', g.trailer_link,
            'multiplayer', g.multiplayer
          )
        ), ']') FROM games g WHERE g.owner_id = u.user_id AND g.showInStore = 1 ORDER BY g.name) as createdGames
      FROM users u
      LEFT JOIN inventories inv ON u.user_id = inv.user_id AND inv.amount > 0
      LEFT JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
      WHERE (u.user_id = ? OR u.discord_id = ? OR u.google_id = ? OR u.steam_id = ?) AND (u.disabled = 0 OR u.disabled IS NULL)
      GROUP BY u.user_id
    `;
        const results = await this.databaseService.read(query, [user_id, user_id, user_id, user_id]);
        if (results.length === 0)
            return null;
        const user = results[0];
        if (user.inventory) {
            user.inventory = user.inventory
                .filter((item) => item !== null)
                .map((item) => ({
                ...item,
                metadata: typeof item.metadata === "string" && item.metadata
                    ? (() => {
                        try {
                            return JSON.parse(item.metadata);
                        }
                        catch {
                            return item.metadata;
                        }
                    })()
                    : item.metadata,
            }))
                .sort((a, b) => {
                const nameCompare = a.name?.localeCompare(b.name || "") || 0;
                if (nameCompare !== 0)
                    return nameCompare;
                if (!a.metadata && b.metadata)
                    return -1;
                if (a.metadata && !b.metadata)
                    return 1;
                return 0;
            });
        }
        if (user.beta_user) {
            user.badges = ["early_user", ...user.badges];
        }
        return {
            user_id: user.user_id,
            username: user.username,
            verified: !!user.verified,
            isStudio: !!user.isStudio,
            admin: !!user.admin,
            inventory: user.inventory || [],
            ownedItems: user.ownedItems || [],
            createdGames: user.createdGames || [],
            beta_user: user.beta_user,
            badges: user.badges || [],
        };
    }
    async adminGetUserWithProfile(user_id) {
        const query = `
      SELECT 
        u.*,
        IFNULL(CONCAT('[', GROUP_CONCAT(
          CASE WHEN inv.item_id IS NOT NULL AND i.itemId IS NOT NULL THEN
            JSON_OBJECT(
              'user_id', inv.user_id,
              'item_id', inv.item_id,
              'itemId', i.itemId,
              'name', i.name,
              'description', i.description,
              'amount', inv.amount,
              'iconHash', i.iconHash,
              'sellable', IF(inv.sellable = 1, 1, 0),
              'purchasePrice', inv.purchasePrice,
              'rarity', inv.rarity,
              'custom_url_link', inv.custom_url_link,
              'metadata', inv.metadata
            )
          END
          ORDER BY i.name SEPARATOR ','
        ), ']'), '[]') as inventory,
        (SELECT IFNULL(CONCAT('[', GROUP_CONCAT(
          JSON_OBJECT(
            'itemId', oi.itemId,
            'name', oi.name,
            'description', oi.description,
            'owner', oi.owner,
            'price', oi.price,
            'iconHash', oi.iconHash,
            'showInStore', oi.showInStore
          )
          ORDER BY oi.name SEPARATOR ','
        ), ']'), '[]') FROM items oi WHERE oi.owner = u.user_id AND (oi.deleted IS NULL OR oi.deleted = 0) AND oi.showInStore = 1) as ownedItems,
        (SELECT IFNULL(CONCAT('[', GROUP_CONCAT(
          JSON_OBJECT(
            'gameId', g.gameId,
            'name', g.name,
            'description', g.description,
            'price', g.price,
            'owner_id', g.owner_id,
            'showInStore', g.showInStore,
            'iconHash', g.iconHash,
            'splashHash', g.splashHash,
            'bannerHash', g.bannerHash,
            'genre', g.genre,
            'release_date', g.release_date,
            'developer', g.developer,
            'publisher', g.publisher,
            'platforms', g.platforms,
            'rating', g.rating,
            'website', g.website,
            'trailer_link', g.trailer_link,
            'multiplayer', g.multiplayer
          )
          ORDER BY g.name SEPARATOR ','
        ), ']'), '[]') FROM games g WHERE g.owner_id = u.user_id AND g.showInStore = 1) as createdGames
      FROM users u
      LEFT JOIN inventories inv ON u.user_id = inv.user_id AND inv.amount > 0
      LEFT JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
      WHERE (u.user_id = ? OR u.discord_id = ? OR u.google_id = ? OR u.steam_id = ?)
      GROUP BY u.user_id
    `;
        const results = await this.databaseService.read(query, [user_id, user_id, user_id, user_id]);
        if (results.length === 0)
            return null;
        const user = results[0];
        if (user.beta_user) {
            user.badges = ["early_user", ...user.badges];
        }
        return user;
    }
    async findByResetToken(reset_token) {
        const users = await this.databaseService.read("SELECT * FROM users WHERE forgot_password_token = ?", [reset_token]);
        return users.length > 0 ? users[0] : null;
    }
    getSteamAuthUrl() {
        const returnUrl = `${process.env.BASE_URL}/api/users/steam-associate`;
        return `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${encodeURIComponent(returnUrl)}&openid.realm=${encodeURIComponent(process.env.BASE_URL || "")}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
    }
};
exports.UserService = UserService;
exports.UserService = UserService = UserService_1 = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], UserService);
