import { IDatabaseService } from "./DatabaseService";
import { User } from "../interfaces/User";
export interface IUserService {
    getDiscordUser(user_id: string): any;
    searchUsersByUsername(query: string): Promise<User[]>;
    updateUserBalance(user_id: string, arg1: number): unknown;
    createUser(user_id: string, username: string, email: string, password: string): Promise<void>;
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
}
export declare class UserService implements IUserService {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    disableAccount(targetUserId: string, adminUserId: string): Promise<void>;
    reenableAccount(targetUserId: string, adminUserId: string): Promise<void>;
    getDiscordUser(userId: string): Promise<any>;
    searchUsersByUsername(query: string): Promise<User[]>;
    updateUserBalance(user_id: string, balance: number): Promise<void>;
    createUser(user_id: string, username: string, email: string, password: string): Promise<void>;
    getUser(user_id: string): Promise<User | null>;
    adminGetUser(user_id: string): Promise<User | null>;
    adminSearchUsers(query: string): Promise<User[]>;
    getAllUsers(): Promise<User[]>;
    getAllUsersWithDisabled(): Promise<User[]>;
    updateUser(user_id: string, username?: string, balance?: number): Promise<void>;
    deleteUser(user_id: string): Promise<void>;
    authenticateUser(api_key: string): Promise<User | null>;
    updateUserPassword(user_id: string, hashedPassword: string): Promise<void>;
}
