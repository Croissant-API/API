export interface User {
    user_id: string;
    username: string;
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
    admin?: boolean;
    verified: boolean;
    isStudio: boolean;
    webauthn_challenge: string;
    webauthn_credentials?: string;
    authenticator_secret?: string;
}
