export class UserRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    users() {
        return this.databaseService.from('users');
    }
    async getUserByAnyId(user_id, includeDisabled = false) {
        let query = this.users()
            .select('*')
            .or(`user_id.eq.${user_id},discord_id.eq.${user_id},google_id.eq.${user_id},steam_id.eq.${user_id}`);
        if (!includeDisabled) {
            query = query.is('disabled', null).or('disabled.eq.0');
        }
        const { data, error } = await query.limit(1);
        if (error)
            throw error;
        return data && data.length ? data[0] : null;
    }
    async getAllUsers(includeDisabled = false) {
        let query = this.users().select('*');
        if (!includeDisabled) {
            query = query.is('disabled', null).or('disabled.eq.0');
        }
        const { data, error } = await query;
        if (error)
            throw error;
        return data || [];
    }
    async updateUserFields(user_id, fields) {
        if (Object.keys(fields).length === 0)
            return;
        const { error } = await this.users().update(fields).eq('user_id', user_id);
        if (error)
            throw error;
    }
    async updateSteamFields(user_id, steam_id, steam_username, steam_avatar_url) {
        const { error } = await this.users().update({ steam_id, steam_username, steam_avatar_url }).eq('user_id', user_id);
        if (error)
            throw error;
    }
    async findByEmail(email) {
        const { data, error } = await this.users().select('*').eq('email', email).limit(1);
        if (error)
            throw error;
        return data && data.length ? data[0] : null;
    }
    async associateOAuth(user_id, provider, providerId) {
        const column = provider === 'discord' ? 'discord_id' : 'google_id';
        const { error } = await this.users().update({ [column]: providerId }).eq('user_id', user_id);
        if (error)
            throw error;
    }
    async disableAccount(targetUserId) {
        const { error } = await this.users().update({ disabled: 1 }).eq('user_id', targetUserId);
        if (error)
            throw error;
    }
    async reenableAccount(targetUserId) {
        const { error } = await this.users().update({ disabled: 0 }).eq('user_id', targetUserId);
        if (error)
            throw error;
    }
    async searchUsers() {
        const { data, error } = await this.users()
            .select('user_id, username, verified, isStudio, admin, badges, beta_user, disabled')
            .limit(100);
        if (error)
            throw error;
        return data || [];
    }
    async createUser(user_id, username, email, password, provider, providerId, created_at) {
        const row = {
            user_id,
            username,
            email,
            password,
            balance: 0,
            discord_id: provider === 'discord' ? providerId : null,
            google_id: provider === 'google' ? providerId : null,
            created_at: created_at || new Date().toISOString(),
        };
        const { error } = await this.users().insert(row);
        if (error)
            throw error;
    }
    async createBrandUser(user_id, username) {
        const { error } = await this.users().insert({ user_id, username, email: '', balance: 0, isStudio: 1 });
        if (error)
            throw error;
    }
    async updateUserPassword(user_id, hashedPassword) {
        await this.updateUserFields(user_id, { password: hashedPassword });
    }
    async getUserBySteamId(steamId) {
        const { data, error } = await this.users()
            .select('*')
            .eq('steam_id', steamId)
            .is('disabled', null)
            .or('disabled.eq.0')
            .limit(1);
        if (error)
            throw error;
        return data && data.length ? data[0] : null;
    }
    async generatePasswordResetToken(email, token) {
        const { error } = await this.users().update({ forgot_password_token: token }).eq('email', email);
        if (error)
            throw error;
    }
    async deleteUser(user_id) {
        const { error } = await this.users().delete().eq('user_id', user_id);
        if (error)
            throw error;
    }
    async updateWebauthnChallenge(user_id, challenge) {
        const { error } = await this.users().update({ webauthn_challenge: challenge }).eq('user_id', user_id);
        if (error)
            throw error;
    }
    async addWebauthnCredential(userId, credentials) {
        const { error } = await this.users().update({ webauthn_credentials: credentials }).eq('user_id', userId);
        if (error)
            throw error;
    }
    async getUserByCredentialId(credentialId) {
        const { data, error } = await this.users()
            .select('*')
            .like('webauthn_credentials', `%${credentialId}%`)
            .is('disabled', null)
            .or('disabled.eq.0')
            .limit(1);
        if (error)
            throw error;
        return data && data.length ? data[0] : null;
    }
    async setAuthenticatorSecret(userId, secret) {
        const { error } = await this.users().update({ authenticator_secret: secret }).eq('user_id', userId);
        if (error)
            throw error;
    }
    async findByResetToken(reset_token) {
        const { data, error } = await this.users().select('*').eq('forgot_password_token', reset_token).limit(1);
        if (error)
            throw error;
        return data && data.length ? data[0] : null;
    }
}
