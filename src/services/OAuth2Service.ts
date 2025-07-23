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
    getUserByCode(code: string, client_id: string): Promise<any | null>;
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
        const { fields, values } = buildUpdateFields(update, { redirect_urls: v => JSON.stringify(v) });
        if (!fields.length) return;
        values.push(client_id, owner_id);
        await this.db.update(
            `UPDATE oauth2_apps SET ${fields.join(", ")} WHERE client_id = ? AND owner_id = ?`,
            values
        );
    }

    async getUserByCode(code: string, client_id: string): Promise<Record<string, unknown> | null> {
        const codeRows = await this.db.read<{ user_id: string }[]>(
            "SELECT * FROM oauth2_codes WHERE code = ? AND client_id = ?",
            [code, client_id]
        );
        if (!codeRows.length) return null;
        const appRows = await this.db.read<OAuth2App[]>(
            "SELECT * FROM oauth2_apps WHERE client_id = ?",
            [client_id]
        );
        if (!appRows.length) return null;
        const userRows = await this.db.read<Record<string, unknown>[]>(
            "SELECT * FROM users WHERE user_id = ?",
            [codeRows[0].user_id]
        );
        return userRows[0] || null;
    }
}

// Helper pour factoriser la génération des champs d'update
function buildUpdateFields(obj: Record<string, unknown>, mapping: Record<string, (v: unknown) => unknown> = {}) {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key in obj) {
    if (typeof obj[key] === "undefined") continue;
    fields.push(`${key} = ?`);
    values.push(mapping[key] ? mapping[key](obj[key]) : obj[key]);
  }
  return { fields, values };
}
