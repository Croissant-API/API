import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { User } from "../interfaces/User";
import { genKey } from "../utils/GenKey";
import { getCachedUser, setCachedUser } from "../utils/UserCache";
import { config } from "dotenv";
import path from "path";

config({path: path.join(__dirname, "..", "..", ".env")});

const BOT_TOKEN = process.env.BOT_TOKEN;

export interface IUserService {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDiscordUser(user_id: string): any;
    searchUsersByUsername(query: string): Promise<User[]>;
    updateUserBalance(user_id: string, arg1: number): unknown;
    createUser(user_id: string, username: string, balance: number): Promise<void>;
    getUser(user_id: string): Promise<User | null>;
    getAllUsers(): Promise<User[]>;
    updateUser(user_id: string, username?: string, balance?: number): Promise<void>;
    deleteUser(user_id: string): Promise<void>;
    authenticateUser(api_key: string): Promise<User | null>;
}

@injectable()
export class UserService implements IUserService {
    constructor(
        @inject("DatabaseService") private databaseService: IDatabaseService
    ) {}

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
            "SELECT * FROM users WHERE username LIKE ?",
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

    async createUser(user_id: string, username: string, balance: number): Promise<void> {
        await this.databaseService.create(
            "INSERT INTO users (user_id, username, balance) VALUES (?, ?, ?)",
            [user_id, username, balance]
        );
    }

    async getUser(user_id: string): Promise<User | null> {
        const users = await this.databaseService.read<User[]>(
            "SELECT * FROM users WHERE user_id = ?",
            [user_id]
        );
        return users.length > 0 ? users[0] : null;
    }

    async getAllUsers(): Promise<User[]> {
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
        const users = await this.getAllUsers();

        if(!users) {
            console.error("Error fetching users", users);
            return null;
        }
        const user = users.find((user) => genKey(user.user_id) === api_key) || null;
        if (!user) {
            console.error("User not found or API key mismatch", api_key);
            return null;
        }
        return user;
    }
}
