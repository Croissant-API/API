import { User } from "../interfaces/User";
import { IDatabaseService } from "../services/DatabaseService";

export class UserRepository {
  constructor(private databaseService: IDatabaseService) {}

  async getUserByAnyId(user_id: string, includeDisabled = false): Promise<User | null> {
    const base = "(user_id = ? OR discord_id = ? OR google_id = ? OR steam_id = ?)";
    const where = includeDisabled ? base : base + " AND (disabled = 0 OR disabled IS NULL)";
    const users = await this.databaseService.read<User>(
      `SELECT * FROM users WHERE ${where}`,
      [user_id, user_id, user_id, user_id]
    );
    return users.length > 0 ? users[0] : null;
  }

  async getAllUsers(includeDisabled = false): Promise<User[]> {
    if (includeDisabled) {
      return await this.databaseService.read<User>("SELECT * FROM users");
    }
    return await this.databaseService.read<User>(
      "SELECT * FROM users WHERE (disabled = 0 OR disabled IS NULL)"
    );
  }

  async updateUserFields(user_id: string, fields: Partial<Pick<User, "username" | "balance" | "password">>): Promise<void> {
    const updates: string[] = [];
    const params: unknown[] = [];
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
    if (updates.length === 0) return;
    params.push(user_id);
    await this.databaseService.request(
      `UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`,
      params
    );
  }

  async updateSteamFields(user_id: string, steam_id: string | null, steam_username: string | null, steam_avatar_url: string | null): Promise<void> {
    await this.databaseService.request(
      "UPDATE users SET steam_id = ?, steam_username = ?, steam_avatar_url = ? WHERE user_id = ?",
      [steam_id, steam_username, steam_avatar_url, user_id]
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const users = await this.databaseService.read<User>(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    return users.length > 0 ? users[0] : null;
  }

  async associateOAuth(user_id: string, provider: "discord" | "google", providerId: string): Promise<void> {
    const column = provider === "discord" ? "discord_id" : "google_id";
    await this.databaseService.request(
      `UPDATE users SET ${column} = ? WHERE user_id = ?`,
      [providerId, user_id]
    );
  }

  async disableAccount(targetUserId: string): Promise<void> {
    await this.databaseService.request(
      "UPDATE users SET disabled = 1 WHERE user_id = ?",
      [targetUserId]
    );
  }

  async reenableAccount(targetUserId: string): Promise<void> {
    await this.databaseService.request(
      "UPDATE users SET disabled = 0 WHERE user_id = ?",
      [targetUserId]
    );
  }

  async searchUsers(): Promise<User[]> {
    return await this.databaseService.read<User>(
      `SELECT user_id, username, verified, isStudio, admin, badges, beta_user, disabled FROM users LIMIT 100`
    );
  }

  async createUser(user_id: string, username: string, email: string, password: string | null, provider?: "discord" | "google", providerId?: string, created_at?: string): Promise<void> {
    await this.databaseService.request(
      "INSERT INTO users (user_id, username, email, password, balance, discord_id, google_id, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
      [
        user_id,
        username,
        email,
        password,
        provider === "discord" ? providerId : null,
        provider === "google" ? providerId : null,
        created_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
      ]
    );
  }

  async createBrandUser(user_id: string, username: string): Promise<void> {
    await this.databaseService.request(
      "INSERT INTO users (user_id, username, email, balance, isStudio) VALUES (?, ?, ?, 0, 1)",
      [user_id, username, ""]
    );
  }

  async updateUserPassword(user_id: string, hashedPassword: string): Promise<void> {
    await this.updateUserFields(user_id, { password: hashedPassword });
  }

  async getUserBySteamId(steamId: string): Promise<User | null> {
    const users = await this.databaseService.read<User>(
      "SELECT * FROM users WHERE steam_id = ? AND (disabled = 0 OR disabled IS NULL)",
      [steamId]
    );
    return users.length > 0 ? users[0] : null;
  }

  async generatePasswordResetToken(email: string, token: string): Promise<void> {
    await this.databaseService.request(
      "UPDATE users SET forgot_password_token = ? WHERE email = ?",
      [token, email]
    );
  }

  async deleteUser(user_id: string): Promise<void> {
    await this.databaseService.request("DELETE FROM users WHERE user_id = ?", [user_id]);
  }

  async updateWebauthnChallenge(user_id: string, challenge: string | null): Promise<void> {
    await this.databaseService.request(
      "UPDATE users SET webauthn_challenge = ? WHERE user_id = ?",
      [challenge, user_id]
    );
  }

  async addWebauthnCredential(userId: string, credentials: string): Promise<void> {
    await this.databaseService.request(
      "UPDATE users SET webauthn_credentials = ? WHERE user_id = ?",
      [credentials, userId]
    );
  }

  async getUserByCredentialId(credentialId: string): Promise<User | null> {
    const users = await this.databaseService.read<User>(
      "SELECT * FROM users WHERE webauthn_credentials LIKE ? AND (disabled = 0 OR disabled IS NULL)",
      [`%${credentialId}%`]
    );
    return users.length > 0 ? users[0] : null;
  }

  async setAuthenticatorSecret(userId: string, secret: string | null): Promise<void> {
    await this.databaseService.request(
      "UPDATE users SET authenticator_secret = ? WHERE user_id = ?",
      [secret, userId]
    );
  }

  async findByResetToken(reset_token: string): Promise<User | null> {
    const users = await this.databaseService.read<User>(
      "SELECT * FROM users WHERE forgot_password_token = ?",
      [reset_token]
    );
    return users.length > 0 ? users[0] : null;
  }
}
