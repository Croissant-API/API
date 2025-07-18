"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuth2Service = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const inversify_1 = require("inversify");
const uuid_1 = require("uuid");
let OAuth2Service = class OAuth2Service {
    constructor(db) {
        this.db = db;
    }
    async createApp(owner_id, name, redirect_urls) {
        // Utilise un vrai identifiant unique pour client_id (remplace par ton générateur de snowflake si besoin)
        const client_id = (0, uuid_1.v4)();
        const client_secret = (0, uuid_1.v4)();
        await this.db.create("INSERT INTO oauth2_apps (owner_id, client_id, client_secret, name, redirect_urls) VALUES (?, ?, ?, ?, ?)", [owner_id, client_id, client_secret, name, JSON.stringify(redirect_urls)]);
        return { owner_id, client_id, client_secret, name, redirect_urls: JSON.stringify(redirect_urls) };
    }
    async getAppsByOwner(owner_id) {
        return await this.db.read("SELECT * FROM oauth2_apps WHERE owner_id = ?", [owner_id]);
    }
    async getAppByClientId(client_id) {
        const rows = await this.db.read("SELECT * FROM oauth2_apps WHERE client_id = ?", [client_id]);
        return rows.length ? rows[0] : null;
    }
    async generateAuthCode(client_id, redirect_uri, user_id) {
        const code = (0, uuid_1.v4)();
        await this.db.create("INSERT INTO oauth2_codes (code, client_id, redirect_uri, user_id) VALUES (?, ?, ?, ?)", [code, client_id, redirect_uri, user_id]);
        return code;
    }
    async exchangeCodeForToken(code, client_id, client_secret, redirect_uri) {
        const rows = await this.db.read("SELECT * FROM oauth2_codes WHERE code = ? AND client_id = ? AND redirect_uri = ?", [code, client_id, redirect_uri]);
        if (!rows.length)
            return null;
        const app = await this.getAppByClientId(client_id);
        if (!app || app.client_secret !== client_secret)
            return null;
        // Ici tu peux générer un vrai JWT, pour l'exemple on retourne juste un token random
        const token = (0, uuid_1.v4)();
        await this.db.create("INSERT INTO oauth2_tokens (token, user_id, client_id) VALUES (?, ?, ?)", [token, rows[0].user_id, client_id]);
        return token;
    }
    async deleteApp(client_id, owner_id) {
        await this.db.delete("DELETE FROM oauth2_apps WHERE client_id = ? AND owner_id = ?", [client_id, owner_id]);
    }
    async updateApp(client_id, owner_id, update) {
        const fields = [];
        const values = [];
        if (update.name) {
            fields.push("name = ?");
            values.push(update.name);
        }
        if (update.redirect_urls) {
            fields.push("redirect_urls = ?");
            values.push(JSON.stringify(update.redirect_urls));
        }
        if (fields.length === 0)
            return;
        values.push(client_id, owner_id);
        await this.db.update(`UPDATE oauth2_apps SET ${fields.join(", ")} WHERE client_id = ? AND owner_id = ?`, values);
    }
    async getUserByCode(code, client_id, client_secret) {
        // Vérifie le code et récupère l'user_id
        const codeRows = await this.db.read("SELECT * FROM oauth2_codes WHERE code = ? AND client_id = ?", [code, client_id]);
        if (!codeRows.length)
            return null;
        // Vérifie le client_secret
        const appRows = await this.db.read("SELECT * FROM oauth2_apps WHERE client_id = ?", [client_id]);
        if (!appRows.length || appRows[0].client_secret !== client_secret)
            return null;
        // Récupère l'utilisateur
        const userRows = await this.db.read("SELECT * FROM users WHERE user_id = ?", [codeRows[0].user_id]);
        if (!userRows.length)
            return null;
        return userRows[0];
    }
};
OAuth2Service = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], OAuth2Service);
exports.OAuth2Service = OAuth2Service;
