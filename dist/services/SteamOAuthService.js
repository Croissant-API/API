"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SteamOAuthService = void 0;
// filepath: src/services/SteamOAuthService.ts
const inversify_1 = require("inversify");
const axios_1 = __importDefault(require("axios"));
const querystring_1 = __importDefault(require("querystring"));
const STEAM_API_KEY = process.env.STEAM_API_KEY || "BE084FB89CC0FF28AC790A9CC5D008A1";
const STEAM_REALM = process.env.STEAM_REALM || "http://localhost:8580/";
const STEAM_RETURN_URL = process.env.STEAM_RETURN_URL || "http://localhost:8580/api/users/steam-associate";
let SteamOAuthService = class SteamOAuthService {
    /**
     * Génère l'URL d'authentification Steam (OpenID)
     */
    getAuthUrl() {
        const params = {
            "openid.ns": "http://specs.openid.net/auth/2.0",
            "openid.mode": "checkid_setup",
            "openid.return_to": STEAM_RETURN_URL,
            "openid.realm": STEAM_REALM,
            "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
            "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select"
        };
        return `https://steamcommunity.com/openid/login?${querystring_1.default.stringify(params)}`;
    }
    /**
     * Vérifie la réponse OpenID de Steam et retourne le steamid si succès
     */
    async verifySteamOpenId(query) {
        // On renvoie la requête à Steam pour validation
        const body = {
            ...query,
            "openid.mode": "check_authentication"
        };
        const response = await axios_1.default.post("https://steamcommunity.com/openid/login", querystring_1.default.stringify(body), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        if (response.data && response.data.includes("is_valid:true")) {
            // Extraire le steamid de openid.claimed_id
            const claimedId = typeof query["openid.claimed_id"] === "string"
                ? query["openid.claimed_id"]
                : (query["openid.claimed_id"] || [])[0];
            const match = claimedId?.match(/\/id\/(\d+)$/) || claimedId?.match(/\/profiles\/(\d+)$/);
            return match ? match[1] : null;
        }
        return null;
    }
    /**
     * Récupère les infos publiques Steam d'un utilisateur via l'API Steam Web
     */
    async getSteamProfile(steamid) {
        const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamid}`;
        const response = await axios_1.default.get(url);
        const player = response.data?.response?.players?.[0];
        if (!player)
            return null;
        return {
            steamid: player.steamid,
            personaname: player.personaname,
            avatarfull: player.avatarfull,
            profileurl: player.profileurl
        };
    }
};
SteamOAuthService = __decorate([
    (0, inversify_1.injectable)()
], SteamOAuthService);
exports.SteamOAuthService = SteamOAuthService;
