"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuth2Repository = void 0;
const uuid_1 = require("uuid");
class OAuth2Repository {
    constructor(db) {
        this.db = db;
    }
    async createApp(owner_id, name, redirect_urls) {
        const client_id = (0, uuid_1.v4)();
        const client_secret = (0, uuid_1.v4)();
        await this.db.request("INSERT INTO oauth2_apps (owner_id, client_id, client_secret, name, redirect_urls) VALUES (?, ?, ?, ?, ?)", [owner_id, client_id, client_secret, name, JSON.stringify(redirect_urls)]);
        return { owner_id, client_id, client_secret, name, redirect_urls };
    }
    // Méthode générique pour récupérer les apps selon des filtres
    async getApps(filters = {}, select = "*") {
        let query = `SELECT ${select} FROM oauth2_apps WHERE 1=1`;
        const params = [];
        if (filters.owner_id) {
            query += " AND owner_id = ?";
            params.push(filters.owner_id);
        }
        if (filters.client_id) {
            query += " AND client_id = ?";
            params.push(filters.client_id);
        }
        const apps = await this.db.read(query, params);
        // Always parse redirect_urls if present
        return apps.map(app => ({
            ...app,
            redirect_urls: typeof app.redirect_urls === "string"
                ? JSON.parse(app.redirect_urls)
                : app.redirect_urls
        }));
    }
    async getAppsByOwner(owner_id) {
        return this.getApps({ owner_id });
    }
    async getFormattedAppsByOwner(owner_id) {
        const apps = await this.db.read("SELECT client_id, client_secret, name, redirect_urls FROM oauth2_apps WHERE owner_id = ?", [owner_id]);
        return apps.map((app) => ({
            client_id: app.client_id,
            client_secret: app.client_secret,
            name: app.name,
            redirect_urls: app.redirect_urls
        }));
    }
    async getAppByClientId(client_id) {
        const apps = await this.getApps({ client_id });
        return apps[0] || null;
    }
    async getFormattedAppByClientId(client_id) {
        const rows = await this.db.read("SELECT client_id, client_secret, name, redirect_urls FROM oauth2_apps WHERE client_id = ?", [client_id]);
        if (!rows)
            return null;
        const app = rows[0];
        return {
            client_id: app.client_id,
            client_secret: app.client_secret,
            name: app.name,
            redirect_urls: app.redirect_urls
        };
    }
    async generateAuthCode(client_id, redirect_uri, user_id) {
        const code = (0, uuid_1.v4)();
        await this.db.request("INSERT INTO oauth2_codes (code, client_id, redirect_uri, user_id) VALUES (?, ?, ?, ?)", [code, client_id, redirect_uri, user_id]);
        return code;
    }
    async deleteApp(client_id, owner_id) {
        await this.db.request("DELETE FROM oauth2_apps WHERE client_id = ? AND owner_id = ?", [client_id, owner_id]);
    }
    async updateApp(client_id, owner_id, update) {
        const { fields, values } = buildUpdateFields(update, { redirect_urls: v => JSON.stringify(v) });
        if (!fields.length)
            return;
        values.push(client_id, owner_id);
        await this.db.request(`UPDATE oauth2_apps SET ${fields.join(", ")} WHERE client_id = ? AND owner_id = ?`, values);
    }
    async getUserByCode(code, client_id) {
        const users = await this.db.read(`SELECT u.username, u.user_id, u.email, u.balance, u.verified, 
              u.steam_username, u.steam_avatar_url, u.steam_id, u.discord_id, u.google_id
       FROM oauth2_codes c
       INNER JOIN oauth2_apps a ON c.client_id = a.client_id
       INNER JOIN users u ON c.user_id = u.user_id
       WHERE c.code = ? AND c.client_id = ?`, [code, client_id]);
        return users[0] || null;
    }
}
exports.OAuth2Repository = OAuth2Repository;
function buildUpdateFields(obj, mapping = {}) {
    const fields = [];
    const values = [];
    for (const key in obj) {
        if (typeof obj[key] === "undefined")
            continue;
        fields.push(`${key} = ?`);
        values.push(mapping[key] ? mapping[key](obj[key]) : obj[key]);
    }
    return { fields, values };
}
