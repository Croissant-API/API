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
exports.UserService = void 0;
const inversify_1 = require("inversify");
const UserRepository_1 = require("../repositories/UserRepository");
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const GenKey_1 = require("../utils/GenKey");
const diacritics_1 = __importDefault(require("diacritics"));
const Jwt_1 = require("../utils/Jwt");
function slugify(str) {
    str = str.normalize("NFKD");
    str = diacritics_1.default.remove(str);
    const substitutions = { "α": "a", "β": "b", "γ": "g", "δ": "d", "ε": "e", "θ": "o", "λ": "l", "μ": "m", "ν": "v", "π": "p", "ρ": "r", "σ": "s", "τ": "t", "φ": "f", "χ": "x", "ψ": "ps", "ω": "w", "ℓ": "l", "𝓁": "l", "𝔩": "l" };
    str = str
        .split("")
        .map((c) => substitutions[c] ?? c)
        .join("");
    str = str.replace(/[^a-zA-Z0-9]/g, "");
    return str.toLowerCase();
}
(0, dotenv_1.config)({ path: path_1.default.join(__dirname, "..", "..", ".env") });
let UserService = class UserService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.apiKeyUserCache = new Map();
        this.userRepository = new UserRepository_1.UserRepository(this.databaseService);
        this.getAllUsersWithDisabled().then((users) => {
            for (const user of users) {
                const key = (0, GenKey_1.genKey)(user.user_id);
                this.apiKeyUserCache.set(key, user);
            }
        });
    }
    // All DB access is now delegated to UserRepository
    async updateSteamFields(user_id, steam_id, steam_username, steam_avatar_url) {
        await this.userRepository.updateSteamFields(user_id, steam_id, steam_username, steam_avatar_url);
    }
    async findByEmail(email) {
        return await this.userRepository.findByEmail(email);
    }
    async associateOAuth(user_id, provider, providerId) {
        await this.userRepository.associateOAuth(user_id, provider, providerId);
    }
    async disableAccount(targetUserId, adminUserId) {
        const admin = await this.adminGetUser(adminUserId);
        if (!admin || !admin.admin) {
            throw new Error("Unauthorized: not admin");
        }
        await this.userRepository.disableAccount(targetUserId);
    }
    async reenableAccount(targetUserId, adminUserId) {
        const admin = await this.adminGetUser(adminUserId);
        if (!admin || !admin.admin) {
            throw new Error("Unauthorized: not admin");
        }
        await this.userRepository.reenableAccount(targetUserId);
    }
    async searchUsersByUsername(query) {
        const users = await this.adminSearchUsers(query);
        // we return users as PublicUser[]
        return users.map((u) => ({
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
        await this.userRepository.createUser(user_id, username, email, password, provider, providerId);
        return (await this.getUser(user_id));
    }
    async createBrandUser(user_id, username) {
        await this.userRepository.createBrandUser(user_id, username);
        return (await this.getUser(user_id));
    }
    async getUser(user_id) {
        return this.userRepository.getUserByAnyId(user_id, false);
    }
    async adminGetUser(user_id) {
        return this.userRepository.getUserByAnyId(user_id, true);
    }
    async adminSearchUsers(query) {
        const users = await this.userRepository.searchUsers();
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
        return this.userRepository.getAllUsers(false);
    }
    async getAllUsersWithDisabled() {
        return this.userRepository.getAllUsers(true);
    }
    async updateUser(user_id, username, balance) {
        await this.userRepository.updateUserFields(user_id, { username, balance });
    }
    async updateUserBalance(user_id, balance) {
        await this.userRepository.updateUserFields(user_id, { balance });
    }
    async updateUserPassword(user_id, hashedPassword) {
        await this.userRepository.updateUserPassword(user_id, hashedPassword);
    }
    async getUserBySteamId(steamId) {
        return await this.userRepository.getUserBySteamId(steamId);
    }
    async generatePasswordResetToken(email) {
        const token = crypto_1.default.randomBytes(32).toString("hex");
        await this.userRepository.generatePasswordResetToken(email, token);
        return token;
    }
    async deleteUser(user_id) {
        await this.userRepository.deleteUser(user_id);
    }
    async authenticateUser(tokenOrApiKey) {
        const jwtPayload = (0, Jwt_1.verifyUserJwt)(tokenOrApiKey);
        if (jwtPayload && jwtPayload.apiKey) {
            return this.getUser(jwtPayload.user_id);
        }
        const apiKey = tokenOrApiKey;
        // Déchiffre l'user_id depuis la clé API
        const userId = (0, GenKey_1.decryptUserId)(apiKey);
        if (!userId)
            return null;
        return this.getUser(userId);
    }
    async updateWebauthnChallenge(user_id, challenge) {
        await this.userRepository.updateWebauthnChallenge(user_id, challenge);
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
        await this.userRepository.addWebauthnCredential(userId, JSON.stringify(credentials));
    }
    async getUserByCredentialId(credentialId) {
        return await this.userRepository.getUserByCredentialId(credentialId);
    }
    async setAuthenticatorSecret(userId, secret) {
        await this.userRepository.setAuthenticatorSecret(userId, secret);
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
            }));
        }
        if (user.ownedItems) {
            user.ownedItems = user.ownedItems.sort((a, b) => {
                const nameCompare = a.name?.localeCompare(b.name || "") || 0;
                if (nameCompare !== 0)
                    return nameCompare;
                return 0;
            });
        }
        return user;
    }
    async getUserWithPublicProfile(user_id) {
        const user = await this.getUserWithCompleteProfile(user_id);
        if (!user)
            return null;
        // complete profile filtered to keep only public information
        const publicProfile = {
            user_id: user.user_id,
            username: user.username,
            verified: user.verified,
            isStudio: user.isStudio,
            admin: user.admin,
            beta_user: user.beta_user,
            badges: user.badges,
        };
        return publicProfile;
    }
    async adminGetUserWithProfile(user_id) {
        const user = await this.getUserWithCompleteProfile(user_id);
        if (!user)
            return null;
        const publicProfile = {
            user_id: user.user_id,
            username: user.username,
            verified: user.verified,
            isStudio: user.isStudio,
            admin: user.admin,
            beta_user: user.beta_user,
            badges: user.badges,
            disabled: user.disabled,
        };
        return publicProfile;
    }
    async findByResetToken(reset_token) {
        return await this.userRepository.findByResetToken(reset_token);
    }
    getSteamAuthUrl() {
        const returnUrl = `${process.env.BASE_URL}/api/users/steam-associate`;
        return `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${encodeURIComponent(returnUrl)}&openid.realm=${encodeURIComponent(process.env.BASE_URL || "")}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], UserService);
