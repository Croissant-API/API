"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
class UserRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getUserByAnyId(user_id, includeDisabled = false) {
        const base = '(user_id = ? OR discord_id = ? OR google_id = ? OR steam_id = ?)';
        const where = includeDisabled ? base : base + ' AND (disabled = 0 OR disabled IS NULL)';
        const users = await this.databaseService.read(`SELECT * FROM users WHERE ${where}`, [user_id, user_id, user_id, user_id]);
        return users.length > 0 ? users[0] : null;
    }
    async getAllUsers(includeDisabled = false) {
        if (includeDisabled) {
            return await this.databaseService.read('SELECT * FROM users');
        }
        return await this.databaseService.read('SELECT * FROM users WHERE (disabled = 0 OR disabled IS NULL)');
    }
    async updateUserFields(user_id, fields) {
        const updates = [];
        const params = [];
        if (fields.username !== undefined) {
            updates.push('username = ?');
            params.push(fields.username);
        }
        if (fields.balance !== undefined) {
            updates.push('balance = ?');
            params.push(fields.balance);
        }
        if (fields.password !== undefined) {
            updates.push('password = ?');
            params.push(fields.password);
        }
        if (updates.length === 0)
            return;
        params.push(user_id);
        await this.databaseService.request(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);
    }
    async updateSteamFields(user_id, steam_id, steam_username, steam_avatar_url) {
        await this.databaseService.request('UPDATE users SET steam_id = ?, steam_username = ?, steam_avatar_url = ? WHERE user_id = ?', [steam_id, steam_username, steam_avatar_url, user_id]);
    }
    async findByEmail(email) {
        const users = await this.databaseService.read('SELECT * FROM users WHERE email = ?', [email]);
        return users.length > 0 ? users[0] : null;
    }
    async associateOAuth(user_id, provider, providerId) {
        const column = provider === 'discord' ? 'discord_id' : 'google_id';
        await this.databaseService.request(`UPDATE users SET ${column} = ? WHERE user_id = ?`, [providerId, user_id]);
    }
    async disableAccount(targetUserId) {
        await this.databaseService.request('UPDATE users SET disabled = 1 WHERE user_id = ?', [targetUserId]);
    }
    async reenableAccount(targetUserId) {
        await this.databaseService.request('UPDATE users SET disabled = 0 WHERE user_id = ?', [targetUserId]);
    }
    async searchUsers() {
        return await this.databaseService.read(`SELECT user_id, username, verified, isStudio, admin, badges, beta_user, disabled FROM users LIMIT 100`);
    }
    async createUser(user_id, username, email, password, provider, providerId, created_at) {
        await this.databaseService.request('INSERT INTO users (user_id, username, email, password, balance, discord_id, google_id, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, COALESCE(?, datetime("now")))', [user_id, username, email, password, provider === 'discord' ? providerId : null, provider === 'google' ? providerId : null, created_at]);
    }
    async createBrandUser(user_id, username) {
        await this.databaseService.request('INSERT INTO users (user_id, username, email, balance, isStudio) VALUES (?, ?, ?, 0, 1)', [user_id, username, '']);
    }
    async updateUserPassword(user_id, hashedPassword) {
        await this.updateUserFields(user_id, { password: hashedPassword });
    }
    async getUserBySteamId(steamId) {
        const users = await this.databaseService.read('SELECT * FROM users WHERE steam_id = ? AND (disabled = 0 OR disabled IS NULL)', [steamId]);
        return users.length > 0 ? users[0] : null;
    }
    async generatePasswordResetToken(email, token) {
        await this.databaseService.request('UPDATE users SET forgot_password_token = ? WHERE email = ?', [token, email]);
    }
    async deleteUser(user_id) {
        await this.databaseService.request('DELETE FROM users WHERE user_id = ?', [user_id]);
    }
    async updateWebauthnChallenge(user_id, challenge) {
        await this.databaseService.request('UPDATE users SET webauthn_challenge = ? WHERE user_id = ?', [challenge, user_id]);
    }
    async addWebauthnCredential(userId, credentials) {
        await this.databaseService.request('UPDATE users SET webauthn_credentials = ? WHERE user_id = ?', [credentials, userId]);
    }
    async getUserByCredentialId(credentialId) {
        const users = await this.databaseService.read('SELECT * FROM users WHERE webauthn_credentials LIKE ? AND (disabled = 0 OR disabled IS NULL)', [`%${credentialId}%`]);
        return users.length > 0 ? users[0] : null;
    }
    async setAuthenticatorSecret(userId, secret) {
        await this.databaseService.request('UPDATE users SET authenticator_secret = ? WHERE user_id = ?', [secret, userId]);
    }
    async findByResetToken(reset_token) {
        const users = await this.databaseService.read('SELECT * FROM users WHERE forgot_password_token = ?', [reset_token]);
        return users.length > 0 ? users[0] : null;
    }
}
exports.UserRepository = UserRepository;
