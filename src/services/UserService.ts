import { inject, injectable } from "inversify";
import { IDatabaseService } from "./database";
import { User } from "../interfaces/User";
import { genKey } from "../utils/GenKey";

export interface IUserService {
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
