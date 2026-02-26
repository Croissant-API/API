"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
class UserRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getUserByAnyId(user_id, includeDisabled = false) {
        const db = await this.databaseService.getDb();
        const query = {
            $or: [
                { user_id },
                { discord_id: user_id },
                { google_id: user_id },
                { steam_id: user_id }
            ]
        };
        if (!includeDisabled) {
            query.$or = query.$or.map((clause) => ({
                ...clause,
                $or: [{ disabled: 0 }, { disabled: { $exists: false } }]
            }));
        }
        const users = await db.collection('users').findOne(query);
        const user = users ? {
            user_id: users.user_id,
            username: users.username,
            email: users.email,
            password: users.password,
            discord_id: users.discord_id,
            google_id: users.google_id,
            steam_id: users.steam_id,
            steam_username: users.steam_username,
            steam_avatar_url: users.steam_avatar_url,
            forgot_password_token: users.forgot_password_token,
            balance: users.balance,
            free_balance: users.free_balance,
            isStudio: users.isStudio,
            disabled: users.disabled,
            created_at: users.created_at,
            verified: users.verified,
            admin: users.admin,
            badges: users.badges,
            beta_user: users.beta_user,
            webauthn_challenge: users.webauthn_challenge,
            webauthn_credentials: users.webauthn_credentials,
            updated_at: users.updated_at,
        } : null;
        return user;
    }
    async getAllUsers(includeDisabled = false) {
        const db = await this.databaseService.getDb();
        const query = {};
        if (!includeDisabled) {
            query.$or = [{ disabled: 0 }, { disabled: { $exists: false } }];
        }
        // return db.collection('users').find(query).toArray();
        const users = await db.collection('users').find(query).toArray();
        return users.map(users => ({
            user_id: users.user_id,
            username: users.username,
            email: users.email,
            password: users.password,
            discord_id: users.discord_id,
            google_id: users.google_id,
            steam_id: users.steam_id,
            steam_username: users.steam_username,
            steam_avatar_url: users.steam_avatar_url,
            forgot_password_token: users.forgot_password_token,
            balance: users.balance,
            free_balance: users.free_balance,
            isStudio: users.isStudio,
            disabled: users.disabled,
            created_at: users.created_at,
            verified: users.verified,
            admin: users.admin,
            badges: users.badges,
            beta_user: users.beta_user,
            webauthn_challenge: users.webauthn_challenge,
            webauthn_credentials: users.webauthn_credentials,
            updated_at: users.updated_at,
        }));
    }
    async updateUserFields(user_id, fields) {
        const db = await this.databaseService.getDb();
        if (!Object.keys(fields).length)
            return;
        await db.collection('users').updateOne({ user_id }, { $set: fields });
    }
    async updateSteamFields(user_id, steam_id, steam_username, steam_avatar_url) {
        const db = await this.databaseService.getDb();
        await db.collection('users').updateOne({ user_id }, { $set: { steam_id, steam_username, steam_avatar_url } });
    }
    async findByEmail(email) {
        const db = await this.databaseService.getDb();
        const user = await db.collection('users').findOne({ email });
        if (!user)
            return null;
        return {
            user_id: user.user_id,
            username: user.username,
            email: user.email,
            password: user.password,
            discord_id: user.discord_id,
            google_id: user.google_id,
            steam_id: user.steam_id,
            steam_username: user.steam_username,
            steam_avatar_url: user.steam_avatar_url,
            forgot_password_token: user.forgot_password_token,
            balance: user.balance,
            free_balance: user.free_balance,
            isStudio: user.isStudio,
            disabled: user.disabled,
            created_at: user.created_at,
            verified: user.verified,
            admin: user.admin,
            badges: user.badges,
            beta_user: user.beta_user,
            webauthn_challenge: user.webauthn_challenge,
            webauthn_credentials: user.webauthn_credentials,
            updated_at: user.updated_at,
        };
        // return db.collection('users').findOne({ email });
    }
    async associateOAuth(user_id, provider, providerId) {
        const db = await this.databaseService.getDb();
        const update = {};
        update[provider === 'discord' ? 'discord_id' : 'google_id'] = providerId;
        await db.collection('users').updateOne({ user_id }, { $set: update });
    }
    async disableAccount(targetUserId) {
        const db = await this.databaseService.getDb();
        await db.collection('users').updateOne({ user_id: targetUserId }, { $set: { disabled: 1 } });
    }
    async reenableAccount(targetUserId) {
        const db = await this.databaseService.getDb();
        await db.collection('users').updateOne({ user_id: targetUserId }, { $set: { disabled: 0 } });
    }
    async searchUsers() {
        const db = await this.databaseService.getDb();
        const users = await db.collection('users')
            .find({}, { projection: { user_id: 1, username: 1, verified: 1, isStudio: 1, admin: 1, badges: 1, beta_user: 1, disabled: 1, _id: 0 } })
            .limit(100)
            .toArray();
        return users.map(user => ({
            user_id: user.user_id,
            username: user.username,
            email: user.email ?? '',
            password: user.password ?? '',
            discord_id: user.discord_id ?? null,
            google_id: user.google_id ?? null,
            steam_id: user.steam_id ?? null,
            steam_username: user.steam_username ?? null,
            steam_avatar_url: user.steam_avatar_url ?? null,
            forgot_password_token: user.forgot_password_token ?? null,
            balance: user.balance ?? 0,
            free_balance: user.free_balance ?? 0,
            isStudio: user.isStudio ?? 0,
            disabled: user.disabled ?? 0,
            created_at: user.created_at ?? '',
            verified: user.verified ?? 0,
            admin: user.admin ?? 0,
            badges: user.badges ?? [],
            beta_user: user.beta_user ?? 0,
            webauthn_challenge: user.webauthn_challenge ?? null,
            webauthn_credentials: user.webauthn_credentials ?? null,
            updated_at: user.updated_at ?? '',
        }));
    }
    async createUser(user_id, username, email, password, provider, providerId, created_at) {
        const db = await this.databaseService.getDb();
        await db.collection('users').insertOne({
            user_id,
            username,
            email,
            password,
            balance: 0,
            discord_id: provider === 'discord' ? providerId : null,
            google_id: provider === 'google' ? providerId : null,
            created_at: created_at || new Date().toISOString(),
            disabled: 0
        });
    }
    async createBrandUser(user_id, username) {
        const db = await this.databaseService.getDb();
        await db.collection('users').insertOne({
            user_id,
            username,
            email: '',
            balance: 0,
            isStudio: 1,
            disabled: 0
        });
    }
    async updateUserPassword(user_id, hashedPassword) {
        await this.updateUserFields(user_id, { password: hashedPassword });
    }
    async getUserBySteamId(steamId) {
        const db = await this.databaseService.getDb();
        const user = await db.collection('users').findOne({ steam_id: steamId, $or: [{ disabled: 0 }, { disabled: { $exists: false } }] });
        if (!user)
            return null;
        return {
            user_id: user.user_id,
            username: user.username,
            email: user.email ?? '',
            password: user.password ?? '',
            discord_id: user.discord_id ?? null,
            google_id: user.google_id ?? null,
            steam_id: user.steam_id ?? null,
            steam_username: user.steam_username ?? null,
            steam_avatar_url: user.steam_avatar_url ?? null,
            forgot_password_token: user.forgot_password_token ?? null,
            balance: user.balance ?? 0,
            free_balance: user.free_balance ?? 0,
            isStudio: user.isStudio ?? 0,
            disabled: user.disabled ?? 0,
            created_at: user.created_at ?? '',
            verified: user.verified ?? 0,
            admin: user.admin ?? 0,
            badges: user.badges ?? [],
            beta_user: user.beta_user ?? 0,
            webauthn_challenge: user.webauthn_challenge ?? null,
            webauthn_credentials: user.webauthn_credentials ?? null,
            updated_at: user.updated_at ?? '',
        };
    }
    async generatePasswordResetToken(email, token) {
        const db = await this.databaseService.getDb();
        await db.collection('users').updateOne({ email }, { $set: { forgot_password_token: token } });
    }
    async deleteUser(user_id) {
        const db = await this.databaseService.getDb();
        await db.collection('users').deleteOne({ user_id });
    }
    async updateWebauthnChallenge(user_id, challenge) {
        const db = await this.databaseService.getDb();
        await db.collection('users').updateOne({ user_id }, { $set: { webauthn_challenge: challenge } });
    }
    async addWebauthnCredential(userId, credentials) {
        const db = await this.databaseService.getDb();
        await db.collection('users').updateOne({ user_id: userId }, { $set: { webauthn_credentials: credentials } });
    }
    async getUserByCredentialId(credentialId) {
        const db = await this.databaseService.getDb();
        const user = await db.collection('users').findOne({ webauthn_credentials: { $regex: credentialId }, $or: [{ disabled: 0 }, { disabled: { $exists: false } }] });
        if (!user)
            return null;
        return {
            user_id: user.user_id,
            username: user.username,
            email: user.email ?? '',
            password: user.password ?? '',
            discord_id: user.discord_id ?? null,
            google_id: user.google_id ?? null,
            steam_id: user.steam_id ?? null,
            steam_username: user.steam_username ?? null,
            steam_avatar_url: user.steam_avatar_url ?? null,
            forgot_password_token: user.forgot_password_token ?? null,
            balance: user.balance ?? 0,
            free_balance: user.free_balance ?? 0,
            isStudio: user.isStudio ?? 0,
            disabled: user.disabled ?? 0,
            created_at: user.created_at ?? '',
            verified: user.verified ?? 0,
            admin: user.admin ?? 0,
            badges: user.badges ?? [],
            beta_user: user.beta_user ?? 0,
            webauthn_challenge: user.webauthn_challenge ?? null,
            webauthn_credentials: user.webauthn_credentials ?? null,
            updated_at: user.updated_at ?? '',
        };
    }
    async setAuthenticatorSecret(userId, secret) {
        const db = await this.databaseService.getDb();
        await db.collection('users').updateOne({ user_id: userId }, { $set: { authenticator_secret: secret } });
    }
    async findByResetToken(reset_token) {
        const db = await this.databaseService.getDb();
        const user = await db.collection('users').findOne({ forgot_password_token: reset_token });
        if (!user)
            return null;
        return {
            user_id: user.user_id,
            username: user.username,
            email: user.email ?? '',
            password: user.password ?? '',
            discord_id: user.discord_id ?? null,
            google_id: user.google_id ?? null,
            steam_id: user.steam_id ?? null,
            steam_username: user.steam_username ?? null,
            steam_avatar_url: user.steam_avatar_url ?? null,
            forgot_password_token: user.forgot_password_token ?? null,
            balance: user.balance ?? 0,
            free_balance: user.free_balance ?? 0,
            isStudio: user.isStudio ?? 0,
            disabled: user.disabled ?? 0,
            created_at: user.created_at ?? '',
            verified: user.verified ?? 0,
            admin: user.admin ?? 0,
            badges: user.badges ?? [],
            beta_user: user.beta_user ?? 0,
            webauthn_challenge: user.webauthn_challenge ?? null,
            webauthn_credentials: user.webauthn_credentials ?? null,
            updated_at: user.updated_at ?? '',
        };
        // return db.collection('users').findOne({ forgot_password_token: reset_token });
    }
}
exports.UserRepository = UserRepository;
