/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { OAuth2App } from "../interfaces/OAuth2App";
import { v4 as uuidv4 } from "uuid";

export interface IOAuth2Service {
    createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App>;
    getAppsByOwner(owner_id: string): Promise<OAuth2App[]>;
    getAppByClientId(client_id: string): Promise<OAuth2App | null>;
    generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string>;
    deleteApp(client_id: string, owner_id: string): Promise<void>;
    updateApp(client_id: string, owner_id: string, update: { name?: string, redirect_urls?: string[] }): Promise<void>;
    getUserByCode(code: string, client_id: string, client_secret: string): Promise<any | null>;
}

@injectable()
export class OAuth2Service implements IOAuth2Service {
    constructor(@inject("DatabaseService") private db: IDatabaseService) {}

    async createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App> {
        const client_id = uuidv4();
        const client_secret = uuidv4();
        await this.db.create(
            "INSERT INTO oauth2_apps (owner_id, client_id, client_secret, name, redirect_urls) VALUES (?, ?, ?, ?, ?)",
            [owner_id, client_id, client_secret, name, JSON.stringify(redirect_urls)]
        );
        return { owner_id, client_id, client_secret, name, redirect_urls: JSON.stringify(redirect_urls) };
    }

    async getAppsByOwner(owner_id: string): Promise<OAuth2App[]> {
        return await this.db.read<OAuth2App[]>(
            "SELECT * FROM oauth2_apps WHERE owner_id = ?",
            [owner_id]
        );
    }

    async getAppByClientId(client_id: string): Promise<OAuth2App | null> {
        const rows = await this.db.read<OAuth2App[]>(
            "SELECT * FROM oauth2_apps WHERE client_id = ?",
            [client_id]
        );
        return rows.length ? rows[0] : null;
    }

    async generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string> {
        const code = uuidv4();
        await this.db.create(
            "INSERT INTO oauth2_codes (code, client_id, redirect_uri, user_id) VALUES (?, ?, ?, ?)",
            [code, client_id, redirect_uri, user_id]
        );
        return code;
    }

    async deleteApp(client_id: string, owner_id: string): Promise<void> {
        await this.db.delete(
            "DELETE FROM oauth2_apps WHERE client_id = ? AND owner_id = ?",
            [client_id, owner_id]
        );
    }

    async updateApp(client_id: string, owner_id: string, update: { name?: string, redirect_urls?: string[] }): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        if (update.name) {
            fields.push("name = ?");
            values.push(update.name);
        }
        if (update.redirect_urls) {
            fields.push("redirect_urls = ?");
            values.push(JSON.stringify(update.redirect_urls));
        }
        if (fields.length === 0) return;
        values.push(client_id, owner_id);
        await this.db.update(
            `UPDATE oauth2_apps SET ${fields.join(", ")} WHERE client_id = ? AND owner_id = ?`,
            values
        );
    }

    async getUserByCode(code: string, client_id: string, client_secret: string): Promise<any | null> {
        const codeRows = await this.db.read<any[]>(
            "SELECT * FROM oauth2_codes WHERE code = ? AND client_id = ?",
            [code, client_id]
        );
        if (!codeRows.length) return null;
        const appRows = await this.db.read<any[]>(
            "SELECT * FROM oauth2_apps WHERE client_id = ?",
            [client_id]
        );
        if (!appRows.length || appRows[0].client_secret !== client_secret) return null;
        const userRows = await this.db.read<any[]>(
            "SELECT * FROM users WHERE user_id = ?",
            [codeRows[0].user_id]
        );
        if (!userRows.length) return null;
        return userRows[0];
    }
}
