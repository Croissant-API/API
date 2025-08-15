import { User } from "../interfaces/User";
import { IDatabaseService } from "../services/DatabaseService";
export declare class UserRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    getUserByAnyId(user_id: string, includeDisabled?: boolean): Promise<User | null>;
    getAllUsers(includeDisabled?: boolean): Promise<User[]>;
    updateUserFields(user_id: string, fields: Partial<Pick<User, "username" | "balance" | "password">>): Promise<void>;
    updateSteamFields(user_id: string, steam_id: string | null, steam_username: string | null, steam_avatar_url: string | null): Promise<void>;
    findByEmail(email: string): Promise<User | null>;
    associateOAuth(user_id: string, provider: "discord" | "google", providerId: string): Promise<void>;
    disableAccount(targetUserId: string): Promise<void>;
    reenableAccount(targetUserId: string): Promise<void>;
    searchUsers(): Promise<User[]>;
    createUser(user_id: string, username: string, email: string, password: string | null, provider?: "discord" | "google", providerId?: string): Promise<void>;
    createBrandUser(user_id: string, username: string): Promise<void>;
    updateUserPassword(user_id: string, hashedPassword: string): Promise<void>;
    getUserBySteamId(steamId: string): Promise<User | null>;
    generatePasswordResetToken(email: string, token: string): Promise<void>;
    deleteUser(user_id: string): Promise<void>;
    updateWebauthnChallenge(user_id: string, challenge: string | null): Promise<void>;
    addWebauthnCredential(userId: string, credentials: string): Promise<void>;
    getUserByCredentialId(credentialId: string): Promise<User | null>;
    setAuthenticatorSecret(userId: string, secret: string | null): Promise<void>;
    findByResetToken(reset_token: string): Promise<User | null>;
}
