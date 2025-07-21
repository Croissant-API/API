export interface User {
    id: number;
    user_id: string; // UUID principal
    balance: number;
    username: string;
    email: string; // Email unique, utilisé comme identifiant principal
    password?: string;
    discord_id?: string; // UUID Discord associé
    google_id?: string; // UUID Google associé
    disabled?: boolean;
    admin?: boolean;
    steam_id?: string; // UUID Steam associé
    steam_username?: string; // Nom d'utilisateur Steam
    steam_avatar_url?: string; // URL de l'avatar Steam
    forgot_password_token?: string; // Token pour réinitialisation de mot de passe
    verified: boolean; // Indique si l'email est vérifié
    isStudio: boolean;
    role: string;
}