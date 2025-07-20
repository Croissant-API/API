export interface ISteamOAuthService {
    getAuthUrl(): string;
    verifySteamOpenId(query: Record<string, string | string[]>): Promise<string | null>;
    getSteamProfile(steamid: string): Promise<{
        steamid: string;
        personaname: string;
        avatarfull: string;
        profileurl: string;
    } | null>;
}
export declare class SteamOAuthService implements ISteamOAuthService {
    /**
     * Génère l'URL d'authentification Steam (OpenID)
     */
    getAuthUrl(): string;
    /**
     * Vérifie la réponse OpenID de Steam et retourne le steamid si succès
     */
    verifySteamOpenId(query: Record<string, string | string[]>): Promise<string | null>;
    /**
     * Récupère les infos publiques Steam d'un utilisateur via l'API Steam Web
     */
    getSteamProfile(steamid: string): Promise<{
        steamid: string;
        personaname: string;
        avatarfull: string;
        profileurl: string;
    } | null>;
}
