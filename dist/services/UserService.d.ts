import { IDatabaseService } from "./DatabaseService";
import { User } from "../interfaces/User";
export interface IUserService {
    updateSteamFields(user_id: string, steam_id: string | null, steam_username: string | null, steam_avatar_url: string | null): Promise<void>;
    getDiscordUser(user_id: string): any;
    searchUsersByUsername(query: string): Promise<User[]>;
    updateUserBalance(user_id: string, arg1: number): unknown;
    createUser(user_id: string, username: string, email: string, password: string | null, provider?: "discord" | "google", providerId?: string): Promise<User>;
    createBrandUser(user_id: string, username: string): Promise<User>;
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
    generatePasswordResetToken(user_id: string): Promise<string>;
    updateWebauthnChallenge(user_id: string, challenge: string | null): Promise<void>;
    addWebauthnCredential(userId: string, credential: {
        id: string;
        name: string;
        created_at: Date;
    }): Promise<void>;
    getUserByCredentialId(credentialId: string): Promise<User | null>;
}
export declare class UserService implements IUserService {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    /**
     * Helper pour générer la clause WHERE pour les IDs (user_id, discord_id, google_id, steam_id)
     */
    private static getIdWhereClause;
    /**
     * Helper pour récupérer un utilisateur par n'importe quel ID
     */
    private fetchUserByAnyId;
    /**
     * Helper pour faire un SELECT * FROM users avec option disabled
     */
    private fetchAllUsers;
    /**
     * Helper pour faire un UPDATE users sur un ou plusieurs champs
     */
    private updateUserFields;
    /**
     * Met à jour les champs Steam de l'utilisateur
     */
    updateSteamFields(user_id: string, steam_id: string | null, steam_username: string | null, steam_avatar_url: string | null): Promise<void>;
    /**
     * Trouve un utilisateur par email (email unique)
     */
    findByEmail(email: string): Promise<User | null>;
    /**
     * Associe un identifiant OAuth (discord ou google) à un utilisateur existant
     */
    associateOAuth(user_id: string, provider: "discord" | "google", providerId: string): Promise<void>;
    disableAccount(targetUserId: string, adminUserId: string): Promise<void>;
    reenableAccount(targetUserId: string, adminUserId: string): Promise<void>;
    getDiscordUser(userId: string): Promise<any>;
    searchUsersByUsername(query: string): Promise<User[]>;
    /**
     * Crée un utilisateur, ou associe un compte OAuth si l'email existe déjà
     * Si providerId et provider sont fournis, associe l'OAuth à l'utilisateur existant
     */
    createUser(user_id: string, username: string, email: string, password: string | null, provider?: "discord" | "google", providerId?: string): Promise<User>;
    createBrandUser(user_id: string, username: string): Promise<User>;
    getUser(user_id: string): Promise<User | null>;
    adminGetUser(user_id: string): Promise<User | null>;
    adminSearchUsers(query: string): Promise<User[]>;
    getAllUsers(): Promise<User[]>;
    getAllUsersWithDisabled(): Promise<User[]>;
    updateUser(user_id: string, username?: string, balance?: number): Promise<void>;
    updateUserBalance(user_id: string, balance: number): Promise<void>;
    updateUserPassword(user_id: string, hashedPassword: string): Promise<void>;
    /**
     * Récupère un utilisateur par son Steam ID
     */
    getUserBySteamId(steamId: string): Promise<User | null>;
    generatePasswordResetToken(email: string): Promise<string>;
    deleteUser(user_id: string): Promise<void>;
    authenticateUser(api_key: string): Promise<User | null>;
    updateWebauthnChallenge(user_id: string, challenge: string | null): Promise<void>;
    addWebauthnCredential(userId: string, credential: {
        id: string;
        name: string;
        created_at: Date;
    }): Promise<void>;
    getUserByCredentialId(credentialId: string): Promise<User | null>;
}
