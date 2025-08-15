import { OAuth2App } from "../interfaces/OAuth2App";
import { IDatabaseService } from "../services/DatabaseService";
import { Oauth2User } from "../interfaces/User";
import { v4 } from "uuid";


export class OAuth2Repository {
  constructor(private db: IDatabaseService) {}

  async createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App> {
    const client_id = v4();
    const client_secret = v4();
    await this.db.request(
      "INSERT INTO oauth2_apps (owner_id, client_id, client_secret, name, redirect_urls) VALUES (?, ?, ?, ?, ?)",
      [owner_id, client_id, client_secret, name, JSON.stringify(redirect_urls)]
    );
    return { owner_id, client_id, client_secret, name, redirect_urls };
  }

  async getAppsByOwner(owner_id: string): Promise<OAuth2App[]> {
    return await this.db.read<OAuth2App>(
      "SELECT * FROM oauth2_apps WHERE owner_id = ?",
      [owner_id]
    );
  }

  async getFormattedAppsByOwner(owner_id: string): Promise<Array<{
    client_id: string;
    client_secret: string;
    name: string;
    redirect_urls: string[];
  }>> {
    const apps = await this.db.read<OAuth2App>(
      "SELECT client_id, client_secret, name, redirect_urls FROM oauth2_apps WHERE owner_id = ?",
      [owner_id]
    );
    return apps.map((app) => ({
      client_id: app.client_id,
      client_secret: app.client_secret,
      name: app.name,
      redirect_urls: app.redirect_urls
    }));
  }

  async getAppByClientId(client_id: string): Promise<OAuth2App | null> {
    const rows = await this.db.read<OAuth2App>(
      "SELECT * FROM oauth2_apps WHERE client_id = ?",
      [client_id]
    );
    return rows.length ? rows[0] : null;
  }

  async getFormattedAppByClientId(client_id: string): Promise<{
    client_id: string;
    client_secret: string;
    name: string;
    redirect_urls: string[];
  } | null> {
    const rows = await this.db.read<OAuth2App>(
      "SELECT client_id, client_secret, name, redirect_urls FROM oauth2_apps WHERE client_id = ?",
      [client_id]
    );
    if (!rows) return null;
    const app = rows[0];
    return {
      client_id: app.client_id,
      client_secret: app.client_secret,
      name: app.name,
      redirect_urls: app.redirect_urls
    };
  }

  async generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string> {
    const code = v4();
    await this.db.request(
      "INSERT INTO oauth2_codes (code, client_id, redirect_uri, user_id) VALUES (?, ?, ?, ?)",
      [code, client_id, redirect_uri, user_id]
    );
    return code;
  }

  async deleteApp(client_id: string, owner_id: string): Promise<void> {
    await this.db.request(
      "DELETE FROM oauth2_apps WHERE client_id = ? AND owner_id = ?",
      [client_id, owner_id]
    );
  }

  async updateApp(client_id: string, owner_id: string, update: { name?: string, redirect_urls?: string[] }): Promise<void> {
    const { fields, values } = buildUpdateFields(update, { redirect_urls: v => JSON.stringify(v) });
    if (!fields.length) return;
    values.push(client_id, owner_id);
    await this.db.request(
      `UPDATE oauth2_apps SET ${fields.join(", ")} WHERE client_id = ? AND owner_id = ?`,
      values
    );
  }

  async getUserByCode(code: string, client_id: string): Promise<Oauth2User | null> {
    const users = await this.db.read<Oauth2User>(
      `SELECT u.username, u.user_id, u.email, u.balance, u.verified, 
              u.steam_username, u.steam_avatar_url, u.steam_id, u.discord_id, u.google_id
       FROM oauth2_codes c
       INNER JOIN oauth2_apps a ON c.client_id = a.client_id
       INNER JOIN users u ON c.user_id = u.user_id
       WHERE c.code = ? AND c.client_id = ?`,
      [code, client_id]
    );
    return users[0] || null;
  }
}

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
