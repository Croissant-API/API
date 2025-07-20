import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { User } from "../interfaces/User";
import { genKey } from "../utils/GenKey";
import { getCachedUser, setCachedUser } from "../utils/UserCache";
import { config } from "dotenv";
import path from "path";

config({ path: path.join(__dirname, "..", "..", ".env") });

const BOT_TOKEN = process.env.BOT_TOKEN;

export interface IUserService {
    updateSteamFields(user_id: string, steam_id: string | null, steam_username: string | null, steam_avatar_url: string | null): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDiscordUser(user_id: string): any;
    searchUsersByUsername(query: string): Promise<User[]>;
    updateUserBalance(user_id: string, arg1: number): unknown;
    createUser(user_id: string, username: string, email: string, password: string | null, provider?: "discord" | "google", providerId?: string): Promise<User>;
    getUser(user_id: string): Promise<User | null>;
    adminGetUser(user_id: string): Promise<User | null>;
    adminSearchUsers(query: string): Promise<User[]>;
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
}

@injectable()
export class UserService implements IUserService {
    /**
     * Met à jour les champs Steam de l'utilisateur
     */
    async updateSteamFields(user_id: string, steam_id: string | null, steam_username: string | null, steam_avatar_url: string | null): Promise<void> {
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
    async associateOAuth(user_id: string, provider: "discord" | "google", providerId: string): Promise<void> {
        const column = provider === "discord" ? "discord_id" : "google_id";
        await this.databaseService.update(
            `UPDATE users SET ${column} = ? WHERE user_id = ?`,
            [providerId, user_id]
        );
    }
    constructor(
        @inject("DatabaseService") private databaseService: IDatabaseService
    ) { }
    async disableAccount(targetUserId: string, adminUserId: string): Promise<void> {
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

    async reenableAccount(targetUserId: string, adminUserId: string): Promise<void> {
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
            const response = await fetch(`https://discord.com/api/v10/users/${userId}`, {
                headers
            });
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


    async updateUserBalance(user_id: string, balance: number): Promise<void> {
        await this.databaseService.update(
            "UPDATE users SET balance = ? WHERE user_id = ?",
            [balance, user_id]
        );
    }

    /**
     * Crée un utilisateur, ou associe un compte OAuth si l'email existe déjà
     * Si providerId et provider sont fournis, associe l'OAuth à l'utilisateur existant
     */
    async createUser(user_id: string, username: string, email: string, password: string | null, provider?: "discord" | "google", providerId?: string): Promise<User> {
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
            [user_id, username, email, password, provider === "discord" ? providerId : null, provider === "google" ? providerId : null]
        );
        return await this.getUser(user_id) as User;
    }

    async getUser(user_id: string): Promise<User | null> {
        const users = await this.databaseService.read<User[]>(
            "SELECT * FROM users WHERE user_id = ? AND (disabled = 0 OR disabled IS NULL)",
            [user_id]
        );
        return users.length > 0 ? users[0] : null;
    }

    async adminGetUser(user_id: string): Promise<User | null> {
        const users = await this.databaseService.read<User[]>(
            "SELECT * FROM users WHERE user_id = ?",
            [user_id]
        );
        return users.length > 0 ? users[0] : null;
    }

    async adminSearchUsers(query: string): Promise<User[]> {
        const users = await this.databaseService.read<User[]>(
            "SELECT * FROM users WHERE username LIKE ?",
            [`%${query}%`]
        );
        return users;
    }

    async getAllUsers(): Promise<User[]> {
        return await this.databaseService.read<User[]>("SELECT * FROM users WHERE (disabled = 0 OR disabled IS NULL)");
    }

    async getAllUsersWithDisabled(): Promise<User[]> {
        // This method retrieves all users, including those who are disabled
        return await this.databaseService.read<User[]>("SELECT * FROM users");
    }

    async updateUser(user_id: string, username?: string, balance?: number): Promise<void> {
        const updates: string[] = [];
        const params: unknown[] = [];
        if (username !== undefined) {
            updates.push("username = ?");
            params.push(username);
        }
        if (balance !== undefined) {
            updates.push("balance = ?");
            params.push(balance);
        }
        if (updates.length === 0) return;
        params.push(user_id);
        await this.databaseService.update(
            `UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`,
            params
        );
    }

    async deleteUser(user_id: string): Promise<void> {
        await this.databaseService.delete(
            "DELETE FROM users WHERE user_id = ?",
            [user_id]
        );
    }

    async authenticateUser(api_key: string): Promise<User | null> {
        const users = await this.getAllUsersWithDisabled();

        if (!users) {
            console.error("Error fetching users", users);
            return null;
        }
        const user = users.find((user) => genKey(user.user_id) === api_key) || null;
        if (!user) {
            // console.error("User not found or API key mismatch", api_key);
            return null;
        }
        return user;
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

    async updateUserPassword(user_id: string, hashedPassword: string): Promise<void> {
        await this.databaseService.update(
            "UPDATE users SET password = ? WHERE user_id = ?",
            [hashedPassword, user_id]
        );
    }
}
