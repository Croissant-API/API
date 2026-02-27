import { User } from '../interfaces/User';
import { IDatabaseService } from '../services/DatabaseService';

export class UserRepository {
  constructor(private databaseService: IDatabaseService) {}

  private users() {
    return this.databaseService.from<User>('users');
  }

  async getUserByAnyId(user_id: string, includeDisabled = false): Promise<User | null> {
    let query = this.users()
      .select('*')
      .or(`user_id.eq.${user_id},discord_id.eq.${user_id},google_id.eq.${user_id},steam_id.eq.${user_id}`);

    if (!includeDisabled) {
      query = query.is('disabled', null).or('disabled.eq.0');
    }

    const { data, error } = await query.limit(1);
    if (error) throw error;
    return data && data.length ? data[0] : null;
  }

  async getAllUsers(includeDisabled = false): Promise<User[]> {
    let query = this.users().select('*');
    if (!includeDisabled) {
      query = query.is('disabled', null).or('disabled.eq.0');
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updateUserFields(user_id: string, fields: Partial<Pick<User, 'username' | 'balance' | 'password'>>): Promise<void> {
    if (Object.keys(fields).length === 0) return;
    const { error } = await this.users().update(fields).eq('user_id', user_id);
    if (error) throw error;
  }

  async updateSteamFields(user_id: string, steam_id: string | null, steam_username: string | null, steam_avatar_url: string | null): Promise<void> {
    const { error } = await this.users().update({ steam_id, steam_username, steam_avatar_url }).eq('user_id', user_id);
    if (error) throw error;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.users().select('*').eq('email', email).limit(1);
    if (error) throw error;
    return data && data.length ? data[0] : null;
  }

  async associateOAuth(user_id: string, provider: 'discord' | 'google', providerId: string): Promise<void> {
    const column = provider === 'discord' ? 'discord_id' : 'google_id';
    const { error } = await this.users().update({ [column]: providerId }).eq('user_id', user_id);
    if (error) throw error;
  }

  async disableAccount(targetUserId: string): Promise<void> {
    const { error } = await this.users().update({ disabled: 1 }).eq('user_id', targetUserId);
    if (error) throw error;
  }

  async reenableAccount(targetUserId: string): Promise<void> {
    const { error } = await this.users().update({ disabled: 0 }).eq('user_id', targetUserId);
    if (error) throw error;
  }

  async searchUsers(): Promise<User[]> {
    const { data, error } = await this.users()
      .select('user_id, username, verified, isStudio, admin, badges, beta_user, disabled')
      .limit(100);
    if (error) throw error;
    return data || [];
  }

  async createUser(user_id: string, username: string, email: string, password: string | null, provider?: 'discord' | 'google', providerId?: string, created_at?: string): Promise<void> {
    const row: Partial<User> = {
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
    if (error) throw error;
  }

  async createBrandUser(user_id: string, username: string): Promise<void> {
    const { error } = await this.users().insert({ user_id, username, email: '', balance: 0, isStudio: 1 });
    if (error) throw error;
  }

  async updateUserPassword(user_id: string, hashedPassword: string): Promise<void> {
    await this.updateUserFields(user_id, { password: hashedPassword });
  }

  async getUserBySteamId(steamId: string): Promise<User | null> {
    const { data, error } = await this.users()
      .select('*')
      .eq('steam_id', steamId)
      .is('disabled', null)
      .or('disabled.eq.0')
      .limit(1);
    if (error) throw error;
    return data && data.length ? data[0] : null;
  }

  async generatePasswordResetToken(email: string, token: string): Promise<void> {
    const { error } = await this.users().update({ forgot_password_token: token }).eq('email', email);
    if (error) throw error;
  }

  async deleteUser(user_id: string): Promise<void> {
    const { error } = await this.users().delete().eq('user_id', user_id);
    if (error) throw error;
  }

  async updateWebauthnChallenge(user_id: string, challenge: string | null): Promise<void> {
    const { error } = await this.users().update({ webauthn_challenge: challenge }).eq('user_id', user_id);
    if (error) throw error;
  }

  async addWebauthnCredential(userId: string, credentials: string): Promise<void> {
    const { error } = await this.users().update({ webauthn_credentials: credentials }).eq('user_id', userId);
    if (error) throw error;
  }

  async getUserByCredentialId(credentialId: string): Promise<User | null> {
    const { data, error } = await this.users()
      .select('*')
      .like('webauthn_credentials', `%${credentialId}%`)
      .is('disabled', null)
      .or('disabled.eq.0')
      .limit(1);
    if (error) throw error;
    return data && data.length ? data[0] : null;
  }

  async setAuthenticatorSecret(userId: string, secret: string | null): Promise<void> {
    const { error } = await this.users().update({ authenticator_secret: secret }).eq('user_id', userId);
    if (error) throw error;
  }

  async findByResetToken(reset_token: string): Promise<User | null> {
    const { data, error } = await this.users().select('*').eq('forgot_password_token', reset_token).limit(1);
    if (error) throw error;
    return data && data.length ? data[0] : null;
  }
}


