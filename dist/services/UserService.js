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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
// crypto shim: prefer Web Crypto in edge environment
const crypto = globalThis.crypto || require('crypto');
const diacritics_1 = __importDefault(require("diacritics"));
const inversify_1 = require("inversify");
const UserRepository_1 = require("../repositories/UserRepository");
const GenKey_1 = require("../utils/GenKey");
const Jwt_1 = require("../utils/Jwt");
function slugify(str) {
    str = str.normalize('NFKD');
    str = diacritics_1.default.remove(str);
    const substitutions = { α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', θ: 'o', λ: 'l', μ: 'm', ν: 'v', π: 'p', ρ: 'r', σ: 's', τ: 't', φ: 'f', χ: 'x', ψ: 'ps', ω: 'w', ℓ: 'l', '𝓁': 'l', '𝔩': 'l' };
    str = str
        .split('')
        .map(c => substitutions[c] ?? c)
        .join('');
    str = str.replace(/[^a-zA-Z0-9]/g, '');
    return str.toLowerCase();
}
let UserService = class UserService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.apiKeyUserCache = new Map();
        this.userRepository = new UserRepository_1.UserRepository(this.databaseService);
        this.getAllUsersWithDisabled().then(users => {
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
            throw new Error('Unauthorized: not admin');
        }
        await this.userRepository.disableAccount(targetUserId);
    }
    async reenableAccount(targetUserId, adminUserId) {
        const admin = await this.adminGetUser(adminUserId);
        if (!admin || !admin.admin) {
            throw new Error('Unauthorized: not admin');
        }
        await this.userRepository.reenableAccount(targetUserId);
    }
    async searchUsersByUsername(query) {
        const users = await this.adminSearchUsers(query);
        // we return users as PublicUser[]
        return users
            .filter((u) => !u.disabled)
            .map((u) => ({
            user_id: u.user_id,
            username: u.username,
            verified: !!u.verified,
            isStudio: !!u.isStudio,
            admin: !!u.admin,
            beta_user: !!u.beta_user,
            badges: u.beta_user ? ['early_user', ...u.badges] : u.badges || [],
            disabled: !!u.disabled, // <-- Ajout ici
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
            badges: u.beta_user ? ['early_user', ...u.badges] : u.badges || [],
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
        const token = crypto.randomBytes(32).toString('hex');
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
            throw new Error('User not found');
        }
        const credentials = JSON.parse(existing.webauthn_credentials || '[]');
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
        // Find user by any id field
        const db = await this.databaseService.getDb();
        const userResult = await db.collection('users').findOne({
            $or: [
                { user_id },
                { discord_id: user_id },
                { google_id: user_id },
                { steam_id: user_id }
            ]
        });
        if (!userResult)
            return null;
        // Remove deleted inventory items
        await db.collection('inventories').deleteMany({
            user_id: userResult.user_id,
            item_id: { $nin: await db.collection('items').distinct('itemId', { $or: [{ deleted: null }, { deleted: 0 }] }) }
        });
        // Inventory
        const inventory = await db.collection('inventories').aggregate([
            { $match: { user_id: userResult.user_id, amount: { $gt: 0 } } },
            {
                $lookup: {
                    from: 'items',
                    localField: 'item_id',
                    foreignField: 'itemId',
                    as: 'item'
                }
            },
            { $unwind: '$item' },
            { $match: { $or: [{ 'item.deleted': null }, { 'item.deleted': 0 }] } },
            {
                $project: {
                    user_id: 1,
                    item_id: 1,
                    itemId: '$item.itemId',
                    name: '$item.name',
                    description: '$item.description',
                    amount: 1,
                    iconHash: '$item.iconHash',
                    sellable: 1,
                    purchasePrice: '$item.purchasePrice',
                    rarity: '$item.rarity',
                    custom_url_link: 1,
                    metadata: 1
                }
            }
        ]).toArray();
        // Owned items
        const ownedItemsResult = await db.collection('items').find({
            owner: userResult.user_id,
            $or: [{ deleted: null }, { deleted: 0 }],
            showInStore: 1
        }).sort({ name: 1 }).toArray();
        const ownedItems = ownedItemsResult.map((item) => ({
            itemId: item.itemId,
            name: item.name,
            description: item.description,
            price: item.price,
            owner: item.owner,
            showInStore: item.showInStore,
            iconHash: item.iconHash,
            deleted: item.deleted,
        }));
        // Created games
        const createdGamesResult = await db.collection('games').find({
            owner_id: userResult.user_id,
            showInStore: 1
        }).sort({ name: 1 }).toArray();
        const createdGames = createdGamesResult.map((game) => ({
            game_id: game.game_id,
            name: game.name,
            description: game.description,
            owner_id: game.owner_id,
            showInStore: game.showInStore,
            iconHash: game.iconHash,
            splashHash: game.splashHash,
            bannerHash: game.bannerHash,
            genre: game.genre,
            release_date: game.release_date,
            developer: game.developer,
            publisher: game.publisher,
            rating: game.rating,
            website: game.website,
            trailer_link: game.trailer_link,
            multiplayer: game.multiplayer,
            gameId: game.game_id,
            price: game.price,
        }));
        // Parse metadata if needed
        const parsedInventory = inventory.map((item) => ({
            ...item,
            metadata: typeof item.metadata === 'string' && item.metadata
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
        // Badges
        let badges = userResult.badges || [];
        if (userResult.beta_user) {
            badges = ['early_user', ...badges];
        }
        const badgeOrder = ['early_user', 'staff', 'bug_hunter', 'contributor', 'moderator', 'community_manager', 'partner'];
        badges = badges.filter((badge) => badgeOrder.includes(badge));
        badges.sort((a, b) => badgeOrder.indexOf(a) - badgeOrder.indexOf(b));
        // Owned items sort
        ownedItems.sort((a, b) => {
            const nameCompare = a.name?.localeCompare(b.name || '') || 0;
            if (nameCompare !== 0)
                return nameCompare;
            return 0;
        });
        return {
            ...userResult,
            inventory: parsedInventory,
            ownedItems,
            createdGames,
            badges
        };
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
            inventory: user.inventory || [],
            ownedItems: user.ownedItems || [],
            createdGames: user.createdGames || [],
            disabled: user.disabled,
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
            inventory: user.inventory,
            ownedItems: user.ownedItems,
            createdGames: user.createdGames,
        };
        return publicProfile;
    }
    async findByResetToken(reset_token) {
        return await this.userRepository.findByResetToken(reset_token);
    }
    getSteamAuthUrl() {
        const returnUrl = `${process.env.BASE_URL}/api/users/steam-associate`;
        return `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${encodeURIComponent(returnUrl)}&openid.realm=${encodeURIComponent(process.env.BASE_URL || '')}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)('DatabaseService'))
], UserService);
