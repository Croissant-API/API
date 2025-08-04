/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { User, PublicUser, UserExtensions } from "../interfaces/User";
import { getCachedUser, setCachedUser } from "../utils/UserCache";
import { config } from "dotenv";
import path from "path";
import crypto from "crypto";
import { genKey } from "../utils/GenKey";
import removeDiacritics from "diacritics";

function slugify(str: string): string {
  str = str.normalize("NFKD");
  str = removeDiacritics.remove(str);
  const substitutions: Record<string, string> = {
    "α": "a", "β": "b", "γ": "g", "δ": "d", "ε": "e", "θ": "o", "λ": "l",
    "μ": "m", "ν": "v", "π": "p", "ρ": "r", "σ": "s", "τ": "t", "φ": "f",
    "χ": "x", "ψ": "ps", "ω": "w", "ℓ": "l", "𝓁": "l", "𝔩": "l"
  };
  str = str.split("").map(c => substitutions[c] ?? c).join("");
  str = str.replace(/[^a-zA-Z0-9]/g, "");
  return str.toLowerCase();
}

config({ path: path.join(__dirname, "..", "..", ".env") });

const BOT_TOKEN = process.env.BOT_TOKEN;

export interface IUserService {
  updateSteamFields(
    user_id: string,
    steam_id: string | null,
    steam_username: string | null,
    steam_avatar_url: string | null
  ): Promise<void>;
  getDiscordUser(user_id: string): any;
  searchUsersByUsername(query: string): Promise<PublicUser[]>;
  updateUserBalance(user_id: string, balance: number): Promise<void>;
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
  adminSearchUsers(query: string): Promise<PublicUser[]>;
  getAllUsers(): Promise<User[]>;
  getAllUsersWithDisabled(): Promise<User[]>;
  updateUser(user_id: string, username?: string, balance?: number): Promise<void>;
  deleteUser(user_id: string): Promise<void>;
  authenticateUser(api_key: string): Promise<User | null>;
  updateUserPassword(user_id: string, hashedPassword: string): Promise<void>;
  disableAccount(targetUserId: string, adminUserId: string): Promise<void>;
  reenableAccount(targetUserId: string, adminUserId: string): Promise<void>;
  findByEmail(email: string): Promise<User | null>;
  associateOAuth(user_id: string, provider: "discord" | "google", providerId: string): Promise<void>;
  getUserBySteamId(steamId: string): Promise<User | null>;
  generatePasswordResetToken(user_id: string): Promise<string>;
  updateWebauthnChallenge(user_id: string, challenge: string | null): Promise<void>;
  addWebauthnCredential(
    userId: string,
    credential: { id: string; name: string; created_at: Date }
  ): Promise<void>;
  getUserByCredentialId(credentialId: string): Promise<User | null>;
  setAuthenticatorSecret(userId: string, secret: string | null): Promise<void>;
  getAuthenticatorSecret(userId: string): Promise<string | null>;
  getUserWithCompleteProfile(user_id: string): Promise<(User & UserExtensions) | null>;
  getUserWithPublicProfile(user_id: string): Promise<(PublicUser & UserExtensions) | null>;
  adminGetUserWithProfile(user_id: string): Promise<(User & UserExtensions) | null>;
  findByResetToken(reset_token: string): Promise<User | null>;
  getSteamAuthUrl(): string;
}

@injectable()
export class UserService implements IUserService {
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) { }

  private static getIdWhereClause(includeDisabled = false) {
    const base = "(user_id = ? OR discord_id = ? OR google_id = ? OR steam_id = ?)";
    if (includeDisabled) return base;
    return base + " AND (disabled = 0 OR disabled IS NULL)";
  }

  private async fetchUserByAnyId(user_id: string, includeDisabled = false): Promise<User | null> {
    const users = await this.databaseService.read<User[]>(
      `SELECT * FROM users WHERE ${UserService.getIdWhereClause(includeDisabled)}`,
      [user_id, user_id, user_id, user_id]
    );
    return users.length > 0 ? users[0] : null;
  }

  private async fetchAllUsers(includeDisabled = false): Promise<User[]> {
    if (includeDisabled) {
      return await this.databaseService.read<User[]>("SELECT * FROM users");
    }
    return await this.databaseService.read<User[]>(
      "SELECT * FROM users WHERE (disabled = 0 OR disabled IS NULL)"
    );
  }

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

  async findByEmail(email: string): Promise<User | null> {
    const users = await this.databaseService.read<User[]>(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    return users.length > 0 ? users[0] : null;
  }

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

  async disableAccount(targetUserId: string, adminUserId: string): Promise<void> {
    const admin = await this.adminGetUser(adminUserId);
    if (!admin || !admin.admin) {
      throw new Error("Unauthorized: not admin");
    }
    await this.databaseService.update(
      "UPDATE users SET disabled = 1 WHERE user_id = ?",
      [targetUserId]
    );
  }

  async reenableAccount(targetUserId: string, adminUserId: string): Promise<void> {
    const admin = await this.adminGetUser(adminUserId);
    if (!admin || !admin.admin) {
      throw new Error("Unauthorized: not admin");
    }
    await this.databaseService.update(
      "UPDATE users SET disabled = 0 WHERE user_id = ?",
      [targetUserId]
    );
  }

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
        { headers }
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

  async searchUsersByUsername(query: string): Promise<PublicUser[]> {
    const users = await this.databaseService.read<User[]>(
      `SELECT user_id, username, verified, isStudio, admin FROM users WHERE (disabled = 0 OR disabled IS NULL)`
    );
    const querySlug = slugify(query);
    const matchedUsers = users.filter((u: User) => {
      return slugify(u.username).indexOf(querySlug) !== -1;
    });
    return matchedUsers.map((u: PublicUser) => ({
      user_id: u.user_id,
      username: u.username,
      verified: !!u.verified,
      isStudio: !!u.isStudio,
      admin: !!u.admin
    }));
  }

  async createUser(
    user_id: string,
    username: string,
    email: string,
    password: string | null,
    provider?: "discord" | "google",
    providerId?: string
  ): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) {
      if (provider && providerId) {
        await this.associateOAuth(existing.user_id, provider, providerId);
      }
      return existing;
    }
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

  async adminSearchUsers(query: string): Promise<PublicUser[]> {
    const users = await this.databaseService.read<User[]>(
      `SELECT user_id, username, verified, isStudio, admin FROM users`
    );
    const querySlug = slugify(query);
    const matchedUsers = users.filter((u: User) => {
      return slugify(u.username).indexOf(querySlug) !== -1;
    });
    return matchedUsers.map((u: User) => ({
      user_id: u.user_id,
      username: u.username,
      verified: !!u.verified,
      isStudio: !!u.isStudio,
      admin: !!u.admin
    }));
  }

  async getAllUsers(): Promise<User[]> {
    return this.fetchAllUsers(false);
  }

  async getAllUsersWithDisabled(): Promise<User[]> {
    return this.fetchAllUsers(true);
  }

  async updateUser(user_id: string, username?: string, balance?: number): Promise<void> {
    await this.updateUserFields(user_id, { username, balance });
  }

  async updateUserBalance(user_id: string, balance: number): Promise<void> {
    await this.updateUserFields(user_id, { balance });
  }

  async updateUserPassword(user_id: string, hashedPassword: string): Promise<void> {
    await this.updateUserFields(user_id, { password: hashedPassword });
  }

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

  async setAuthenticatorSecret(userId: string, secret: string | null): Promise<void> {
    return this.databaseService.update(
      "UPDATE users SET authenticator_secret = ? WHERE user_id = ?",
      [secret, userId]
    );
  }

  async getAuthenticatorSecret(userId: string): Promise<string | null> {
    const user = await this.getUser(userId);
    return user ? user.authenticator_secret || null : null;
  }

  async getUserWithCompleteProfile(user_id: string): Promise<(User & UserExtensions) | null> {
    const query = `
      SELECT 
        u.*,
        json_group_array(
          CASE WHEN inv.item_id IS NOT NULL AND i.itemId IS NOT NULL THEN
            json_object(
              'user_id', inv.user_id,
              'item_id', inv.item_id,
              'itemId', i.itemId,
              'name', i.name,
              'description', i.description,
              'amount', inv.amount,
              'iconHash', i.iconHash,
              'sellable', CASE WHEN inv.sellable = 1 THEN 1 ELSE 0 END,
              'purchasePrice', inv.purchasePrice,
              'metadata', CASE WHEN inv.metadata IS NOT NULL THEN json(inv.metadata) ELSE NULL END
            )
          END
        ) as inventory,
        (SELECT json_group_array(
          json_object(
            'itemId', oi.itemId,
            'name', oi.name,
            'description', oi.description,
            'owner', oi.owner,
            'price', oi.price,
            'iconHash', oi.iconHash,
            'showInStore', oi.showInStore
          )
        ) FROM items oi WHERE oi.owner = u.user_id AND (oi.deleted IS NULL OR oi.deleted = 0) AND oi.showInStore = 1 ORDER BY oi.name) as ownedItems,
        (SELECT json_group_array(
          json_object(
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
        ) FROM games g WHERE g.owner_id = u.user_id AND g.showInStore = 1 ORDER BY g.name) as createdGames
      FROM users u
      LEFT JOIN inventories inv ON u.user_id = inv.user_id AND inv.amount > 0
      LEFT JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
      WHERE (u.user_id = ? OR u.discord_id = ? OR u.google_id = ? OR u.steam_id = ?) AND (u.disabled = 0 OR u.disabled IS NULL)
      GROUP BY u.user_id
    `;

    await this.databaseService.update(
      `DELETE FROM inventories 
       WHERE user_id = (
         SELECT user_id FROM users 
         WHERE user_id = ? OR discord_id = ? OR google_id = ? OR steam_id = ?
       ) 
       AND item_id NOT IN (
         SELECT itemId FROM items WHERE deleted IS NULL OR deleted = 0
       )`,
      [user_id, user_id, user_id, user_id]
    );

    const results = await this.databaseService.read<any[]>(query, [user_id, user_id, user_id, user_id]);
    if (results.length === 0) return null;

    const user = results[0];
    if (user.inventory) {
      user.inventory = JSON.parse(user.inventory).filter((item: any) => item !== null);
      user.inventory.sort((a: any, b: any) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        if (!a.metadata && b.metadata) return -1;
        if (a.metadata && !b.metadata) return 1;
        return 0;
      });
    }
    if (user.ownedItems) {
      user.ownedItems = JSON.parse(user.ownedItems);
    }
    if (user.createdGames) {
      user.createdGames = JSON.parse(user.createdGames);
    }

    return user;
  }

  async getUserWithPublicProfile(user_id: string): Promise<(PublicUser & UserExtensions) | null> {
    const query = `
      SELECT 
        u.user_id, u.username, u.verified, u.isStudio, u.admin,
        json_group_array(
          CASE WHEN inv.item_id IS NOT NULL AND i.itemId IS NOT NULL THEN
            json_object(
              'user_id', inv.user_id,
              'item_id', inv.item_id,
              'itemId', i.itemId,
              'name', i.name,
              'description', i.description,
              'amount', inv.amount,
              'iconHash', i.iconHash,
              'sellable', CASE WHEN inv.sellable = 1 THEN 1 ELSE 0 END,
              'purchasePrice', inv.purchasePrice,
              'metadata', CASE WHEN inv.metadata IS NOT NULL THEN json(inv.metadata) ELSE NULL END
            )
          END
        ) as inventory,
        (SELECT json_group_array(
          json_object(
            'itemId', oi.itemId,
            'name', oi.name,
            'description', oi.description,
            'owner', oi.owner,
            'price', oi.price,
            'iconHash', oi.iconHash,
            'showInStore', oi.showInStore
          )
        ) FROM items oi WHERE oi.owner = u.user_id AND (oi.deleted IS NULL OR oi.deleted = 0) AND oi.showInStore = 1 ORDER BY oi.name) as ownedItems,
        (SELECT json_group_array(
          json_object(
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
        ) FROM games g WHERE g.owner_id = u.user_id AND g.showInStore = 1 ORDER BY g.name) as createdGames
      FROM users u
      LEFT JOIN inventories inv ON u.user_id = inv.user_id AND inv.amount > 0
      LEFT JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
      WHERE (u.user_id = ? OR u.discord_id = ? OR u.google_id = ? OR u.steam_id = ?) AND (u.disabled = 0 OR u.disabled IS NULL)
      GROUP BY u.user_id
    `;

    const results = await this.databaseService.read<any[]>(query, [user_id, user_id, user_id, user_id]);
    if (results.length === 0) return null;

    const user = results[0];
    if (user.inventory) {
      user.inventory = JSON.parse(user.inventory).filter((item: any) => item !== null);
      user.inventory.sort((a: any, b: any) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        if (!a.metadata && b.metadata) return -1;
        if (a.metadata && !b.metadata) return 1;
        return 0;
      });
    }
    if (user.ownedItems) {
      user.ownedItems = JSON.parse(user.ownedItems);
    }
    if (user.createdGames) {
      user.createdGames = JSON.parse(user.createdGames);
    }

    return {
      user_id: user.user_id,
      username: user.username,
      verified: !!user.verified,
      isStudio: !!user.isStudio,
      admin: !!user.admin,
      inventory: user.inventory || [],
      ownedItems: user.ownedItems || [],
      createdGames: user.createdGames || []
    };
  }

  async adminGetUserWithProfile(user_id: string): Promise<(User & UserExtensions) | null> {
    const query = `
      SELECT 
        u.*,
        json_group_array(
          CASE WHEN inv.item_id IS NOT NULL AND i.itemId IS NOT NULL THEN
            json_object(
              'user_id', inv.user_id,
              'item_id', inv.item_id,
              'itemId', i.itemId,
              'name', i.name,
              'description', i.description,
              'amount', inv.amount,
              'iconHash', i.iconHash,
              'sellable', CASE WHEN inv.sellable = 1 THEN 1 ELSE 0 END,
              'purchasePrice', inv.purchasePrice,
              'metadata', CASE WHEN inv.metadata IS NOT NULL THEN json(inv.metadata) ELSE NULL END
            )
          END
        ) as inventory,
        (SELECT json_group_array(
          json_object(
            'itemId', oi.itemId,
            'name', oi.name,
            'description', oi.description,
            'owner', oi.owner,
            'price', oi.price,
            'iconHash', oi.iconHash,
            'showInStore', oi.showInStore
          )
        ) FROM items oi WHERE oi.owner = u.user_id AND (oi.deleted IS NULL OR oi.deleted = 0) AND oi.showInStore = 1 ORDER BY oi.name) as ownedItems,
        (SELECT json_group_array(
          json_object(
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
        ) FROM games g WHERE g.owner_id = u.user_id AND g.showInStore = 1 ORDER BY g.name) as createdGames
      FROM users u
      LEFT JOIN inventories inv ON u.user_id = inv.user_id AND inv.amount > 0
      LEFT JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
      WHERE (u.user_id = ? OR u.discord_id = ? OR u.google_id = ? OR u.steam_id = ?)
      GROUP BY u.user_id
    `;

    const results = await this.databaseService.read<any[]>(query, [user_id, user_id, user_id, user_id]);
    if (results.length === 0) return null;

    const user = results[0];
    if (user.inventory) {
      user.inventory = JSON.parse(user.inventory).filter((item: any) => item !== null);
      user.inventory.sort((a: any, b: any) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        if (!a.metadata && b.metadata) return -1;
        if (a.metadata && !b.metadata) return 1;
        return 0;
      });
    }
    if (user.ownedItems) {
      user.ownedItems = JSON.parse(user.ownedItems);
    }
    if (user.createdGames) {
      user.createdGames = JSON.parse(user.createdGames);
    }

    return user;
  }

  async findByResetToken(reset_token: string): Promise<User | null> {
    const users = await this.databaseService.read<User[]>(
      "SELECT * FROM users WHERE forgot_password_token = ?",
      [reset_token]
    );
    return users.length > 0 ? users[0] : null;
  }

  getSteamAuthUrl(): string {
    const returnUrl = `${process.env.BASE_URL}/api/users/steam-associate`;
    return `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${encodeURIComponent(returnUrl)}&openid.realm=${encodeURIComponent(process.env.BASE_URL || '')}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
  }
}
