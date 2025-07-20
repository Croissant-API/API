export interface User {
    id: number;
    user_id: string;
    balance: number;
    username: string;
    email: string;
    password?: string;
    discord_id?: string;
    google_id?: string;
    disabled?: boolean;
    admin?: boolean;
    steam_id?: string;
    steam_username?: string;
    steam_avatar_url?: string;
}
