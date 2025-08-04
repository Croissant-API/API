export interface PublicUser {
    user_id: string;
    username: string;
    verified: boolean;
    isStudio: boolean;
    admin?: boolean;
}

export interface User extends PublicUser {
    email: string;
    password?: string;
    discord_id?: string;
    google_id?: string;
    steam_id?: string;
    steam_username?: string;
    steam_avatar_url?: string;
    forgot_password_token?: string;
    balance: number;
    free_balance: number;
    disabled?: boolean;
    webauthn_challenge: string;
    webauthn_credentials?: string;
    authenticator_secret?: string;
}

export interface UserExtensions {
    inventory?: any[];
    ownedItems?: any[];
    createdGames?: any[];
}
