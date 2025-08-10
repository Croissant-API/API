import { injectable } from "inversify";
import axios from "axios";
import querystring from "querystring";

const STEAM_API_KEY =
  process.env.STEAM_API_KEY || "BE084FB89CC0FF28AC790A9CC5D008A1";
const STEAM_REALM = process.env.STEAM_REALM || "http://localhost:8580/";
const STEAM_RETURN_URL =
  process.env.STEAM_RETURN_URL ||
  "http://localhost:8580/api/users/steam-associate";

export interface ISteamOAuthService {
  getAuthUrl(): string;
  verifySteamOpenId(
    query: Record<string, string | string[]>
  ): Promise<string | null>;
  getSteamProfile(steamid: string): Promise<{
    steamid: string;
    personaname: string;
    avatarfull: string;
    profileurl: string;
  } | null>;
}

@injectable()
export class SteamOAuthService implements ISteamOAuthService {
  private extractSteamId(claimedId: string | undefined): string | null {
    if (!claimedId) return null;
    const match =
      claimedId.match(/\/(id|profiles)\/(\d+)$/);
    return match ? match[2] : null;
  }

  /**
   * Génère l'URL d'authentification Steam (OpenID)
   */
  getAuthUrl(): string {
    const params = {
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": STEAM_RETURN_URL,
      "openid.realm": STEAM_REALM,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    };
    return `https://steamcommunity.com/openid/login?${querystring.stringify(params)}`;
  }

  /**
   * Vérifie la réponse OpenID de Steam et retourne le steamid si succès
   */
  async verifySteamOpenId(
    query: Record<string, string | string[]>
  ): Promise<string | null> {
    const body = { ...query, "openid.mode": "check_authentication" };
    try {
      const response = await axios.post(
        "https://steamcommunity.com/openid/login",
        querystring.stringify(body),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      if (response.data && response.data.includes("is_valid:true")) {
        const claimedId = typeof query["openid.claimed_id"] === "string"
          ? query["openid.claimed_id"]
          : (query["openid.claimed_id"] || [])[0];
        return this.extractSteamId(claimedId);
      }
    } catch (e: unknown) {
      console.error("Error verifying Steam OpenID", e);
      // Optionally log error
    }
    return null;
  }

  /**
   * Récupère les infos publiques Steam d'un utilisateur via l'API Steam Web
   */
  async getSteamProfile(steamid: string): Promise<{
    steamid: string;
    personaname: string;
    avatarfull: string;
    profileurl: string;
  } | null> {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamid}`;
    try {
      const response = await axios.get(url);
      const player = response.data?.response?.players?.[0];
      if (!player) return null;
      return {
        steamid: player.steamid,
        personaname: player.personaname,
        avatarfull: player.avatarfull,
        profileurl: player.profileurl,
      };
    } catch (e: unknown) {
      console.error("Error fetching Steam profile", e);
      return null;
    }
  }
}
