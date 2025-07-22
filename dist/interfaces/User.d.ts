export interface User {
    user_id: string;
    username: string;
    email: string;
    role: string;
    password?: string;
    discord_id?: string;
    google_id?: string;
    steam_id?: string;
    steam_username?: string;
    steam_avatar_url?: string;
    forgot_password_token?: string;
    id: number;
    balance: number;
    disabled?: boolean;
    admin?: boolean;
    verified: boolean;
    isStudio: boolean;
}
