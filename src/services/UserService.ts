import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { User } from "../interfaces/User";
import { getCachedUser, setCachedUser } from "../utils/UserCache";
import { config } from "dotenv";
import path from "path";
import crypto from "crypto";
import { genKey } from "../utils/GenKey";

config({ path: path.join(__dirname, "..", "..", ".env") });

const BOT_TOKEN = process.env.BOT_TOKEN;

export interface IUserService {
  updateSteamFields(
    user_id: string,
    steam_id: string | null,
    steam_username: string | null,
    steam_avatar_url: string | null
  ): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDiscordUser(user_id: string): any;
  searchUsersByUsername(query: string): Promise<User[]>;
  updateUserBalance(user_id: string, arg1: number): unknown;
  createUser(
    user_id: string,
    username: string,
    email: string,
    password: string | null,
    provider?: "discord" | "google",
    providerId?: string
  ): Promise<User>;
  createBrandUser(user_id: string, username: string): Promise<User>;
  getUser(user_id: string): Promise<User | null>;
  adminGetUser(user_id: string): Promise<User | null>;
  adminSearchUsers(query: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  getAllUsersWithDisabled(): Promise<User[]>;
  updateUser(
    user_id: string,
    username?: string,
    balance?: number
  ): Promise<void>;
  deleteUser(user_id: string): Promise<void>;
  authenticateUser(api_key: string): Promise<User | null>;
  updateUserPassword(user_id: string, hashedPassword: string): Promise<void>;
  disableAccount(targetUserId: string, adminUserId: string): Promise<void>;
  reenableAccount(targetUserId: string, adminUserId: string): Promise<void>;
  findByEmail(email: string): Promise<User | null>;
  associateOAuth(
    user_id: string,
    provider: "discord" | "google",
    providerId: string
  ): Promise<void>;
  getUserBySteamId(steamId: string): Promise<User | null>;
  generatePasswordResetToken(user_id: string): Promise<string>;
  updateWebauthnChallenge(user_id: string, challenge: string | null): Promise<void>;
  addWebauthnCredential(
    userId: string,
    credential: { id: string; name: string; created_at: Date }
  ): Promise<void>;
  getUserByCredentialId(credentialId: string): Promise<User | null>;
}

@injectable()
export class UserService implements IUserService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {}

  // --- Helpers privés ---
  /**
   * Helper pour générer la clause WHERE pour les IDs (user_id, discord_id, google_id, steam_id)
   */
  private static getIdWhereClause(includeDisabled = false) {
    const base = "(user_id = ? OR discord_id = ? OR google_id = ? OR steam_id = ?)";
    if (includeDisabled) return base;
    return base + " AND (disabled = 0 OR disabled IS NULL)";
  }

  /**
   * Helper pour récupérer un utilisateur par n'importe quel ID
   */
  private async fetchUserByAnyId(user_id: string, includeDisabled = false): Promise<User | null> {
    const users = await this.databaseService.read<User[]>(
      `SELECT * FROM users WHERE ${UserService.getIdWhereClause(includeDisabled)}`,
      [user_id, user_id, user_id, user_id]
    );
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Helper pour faire un SELECT * FROM users avec option disabled
   */
  private async fetchAllUsers(includeDisabled = false): Promise<User[]> {
    if (includeDisabled) {
      return await this.databaseService.read<User[]>("SELECT * FROM users");
    }
    return await this.databaseService.read<User[]>(
      "SELECT * FROM users WHERE (disabled = 0 OR disabled IS NULL)"
    );
  }

  /**
   * Helper pour faire un UPDATE users sur un ou plusieurs champs
   */
  private async updateUserFields(user_id: string, fields: Partial<Pick<User, 'username' | 'balance' | 'password'>>): Promise<void> {
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
    await this.databaseService.update(
      `UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`,
      params
    );
  }

  /**
   * Met à jour les champs Steam de l'utilisateur
   */
  async updateSteamFields(
    user_id: string,
    steam_id: string | null,
    steam_username: string | null,
    steam_avatar_url: string | null
  ): Promise<void> {
    await this.databaseService.update(
      "UPDATE users SET steam_id = ?, steam_username = ?, steam_avatar_url = ? WHERE user_id = ?",
      [steam_id, steam_username, steam_avatar_url, user_id]
    );
  }
  /**
   * Trouve un utilisateur par email (email unique)
   */
  async findByEmail(email: string): Promise<User | null> {
    const users = await this.databaseService.read<User[]>(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Associe un identifiant OAuth (discord ou google) à un utilisateur existant
   */
  async associateOAuth(
    user_id: string,
    provider: "discord" | "google",
    providerId: string
  ): Promise<void> {
    const column = provider === "discord" ? "discord_id" : "google_id";
    await this.databaseService.update(
      `UPDATE users SET ${column} = ? WHERE user_id = ?`,
      [providerId, user_id]
    );
  }

  async disableAccount(
    targetUserId: string,
    adminUserId: string
  ): Promise<void> {
    // Check if adminUserId is admin
    const admin = await this.adminGetUser(adminUserId);
    if (!admin || !admin.admin) {
      throw new Error("Unauthorized: not admin");
    }
    await this.databaseService.update(
      "UPDATE users SET disabled = 1 WHERE user_id = ?",
      [targetUserId]
    );
  }

  async reenableAccount(
    targetUserId: string,
    adminUserId: string
  ): Promise<void> {
    // Check if adminUserId is admin
    const admin = await this.adminGetUser(adminUserId);
    if (!admin || !admin.admin) {
      throw new Error("Unauthorized: not admin");
    }
    await this.databaseService.update(
      "UPDATE users SET disabled = 0 WHERE user_id = ?",
      [targetUserId]
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getDiscordUser(userId: string): Promise<any> {
    try {
      const cached = getCachedUser(userId);
      if (cached) {
        return cached;
      }
      const headers: Record<string, string> = {};
      if (BOT_TOKEN) {
        headers["Authorization"] = "Bot " + BOT_TOKEN;
      }
      const response = await fetch(
        `https://discord.com/api/v10/users/${userId}`,
        {
          headers,
        }
      );
      if (!response.ok) {
        return null;
      }
      const user = await response.json();
      setCachedUser(userId, user);
      return user;
    } catch (error) {
      console.error("Error fetching Discord user:", error);
      return null;
    }
  }

  async searchUsersByUsername(query: string): Promise<User[]> {
    const users = await this.databaseService.read<User[]>(
      "SELECT * FROM users WHERE username LIKE ? AND (disabled = 0 OR disabled IS NULL)",
      [`%${query}%`]
    );
    return users;
  }

  /**
   * Crée un utilisateur, ou associe un compte OAuth si l'email existe déjà
   * Si providerId et provider sont fournis, associe l'OAuth à l'utilisateur existant
   */
  async createUser(
    user_id: string,
    username: string,
    email: string,
    password: string | null,
    provider?: "discord" | "google",
    providerId?: string
  ): Promise<User> {
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
    await this.databaseService.create(
      "INSERT INTO users (user_id, username, email, password, balance, discord_id, google_id) VALUES (?, ?, ?, ?, 0, ?, ?)",
      [
        user_id,
        username,
        email,
        password,
        provider === "discord" ? providerId : null,
        provider === "google" ? providerId : null,
      ]
    );
    return (await this.getUser(user_id)) as User;
  }

  async createBrandUser(user_id: string, username: string): Promise<User> {
    // Crée un utilisateur de marque sans email ni mot de passe
    await this.databaseService.create(
      "INSERT INTO users (user_id, username, email, balance, isStudio) VALUES (?, ?, ?, 0, 1)",
      [user_id, username, ""]
    );
    return (await this.getUser(user_id)) as User;
  }

  async getUser(user_id: string): Promise<User | null> {
    return this.fetchUserByAnyId(user_id, false);
  }

  async adminGetUser(user_id: string): Promise<User | null> {
    return this.fetchUserByAnyId(user_id, true);
  }

  async adminSearchUsers(query: string): Promise<User[]> {
    const users = await this.databaseService.read<User[]>(
      "SELECT * FROM users WHERE username LIKE ?",
      [`%${query}%`]
    );
    return users;
  }

  async getAllUsers(): Promise<User[]> {
    return this.fetchAllUsers(false);
  }

  async getAllUsersWithDisabled(): Promise<User[]> {
    return this.fetchAllUsers(true);
  }

  async updateUser(
    user_id: string,
    username?: string,
    balance?: number
  ): Promise<void> {
    await this.updateUserFields(user_id, { username, balance });
  }

  async updateUserBalance(user_id: string, balance: number): Promise<void> {
    await this.updateUserFields(user_id, { balance });
  }

  async updateUserPassword(
    user_id: string,
    hashedPassword: string
  ): Promise<void> {
    await this.updateUserFields(user_id, { password: hashedPassword });
  }

  /**
   * Récupère un utilisateur par son Steam ID
   */
  async getUserBySteamId(steamId: string): Promise<User | null> {
    const users = await this.databaseService.read<User[]>(
      "SELECT * FROM users WHERE steam_id = ? AND (disabled = 0 OR disabled IS NULL)",
      [steamId]
    );
    return users.length > 0 ? users[0] : null;
  }

  async generatePasswordResetToken(email: string): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    await this.databaseService.update(
      "UPDATE users SET forgot_password_token = ? WHERE email = ?",
      [token, email]
    );
    return token;
  }

  async deleteUser(user_id: string): Promise<void> {
    await this.databaseService.delete("DELETE FROM users WHERE user_id = ?", [
      user_id,
    ]);
  }

  async authenticateUser(api_key: string): Promise<User | null> {
    const users = await this.getAllUsersWithDisabled();
    if (!users) {
      console.error("Error fetching users", users);
      return null;
    }
    const user = users.find((user) => genKey(user.user_id) === api_key) || null;
    if (!user) {
      return null;
    }
    return user;
  }

  async updateWebauthnChallenge(user_id: string, challenge: string | null): Promise<void> {
    await this.databaseService.update(
      "UPDATE users SET webauthn_challenge = ? WHERE user_id = ?",
      [challenge, user_id]
    );
  }

  async addWebauthnCredential(
    userId: string,
    credential: { id: string; name: string; created_at: Date }
  ): Promise<void> {
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
    await this.databaseService.update(
      "UPDATE users SET webauthn_credentials = ? WHERE user_id = ?",
      [JSON.stringify(credentials), userId]
    );
  }
  
  async getUserByCredentialId(credentialId: string): Promise<User | null> {
    const users = await this.databaseService.read<User[]>(
      "SELECT * FROM users WHERE webauthn_credentials LIKE ? AND (disabled = 0 OR disabled IS NULL)",
      [`%${credentialId}%`]
    );
    return users.length > 0 ? users[0] : null;
  }
}
