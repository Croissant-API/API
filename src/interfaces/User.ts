export interface User {
    // Required string fields
    user_id: string; // UUID principal
    username: string;
    email: string; // Email unique, utilisé comme identifiant principal

    // Optional string fields
    password?: string;
    discord_id?: string; // ID Snowflake Discord associé
    google_id?: string; // ID Google associé
    steam_id?: string; // ID Steam associé
    steam_username?: string; // Nom d'utilisateur Steam
    steam_avatar_url?: string; // URL de l'avatar Steam
    forgot_password_token?: string; // Token pour réinitialisation de mot de passe

    // Required number fields
    balance: number;
    free_balance: number;

    // Optional boolean fields
    disabled?: boolean;
    admin?: boolean;

    // Required boolean fields
    verified: boolean; // Indique si l'email est vérifié
    isStudio: boolean;
}
