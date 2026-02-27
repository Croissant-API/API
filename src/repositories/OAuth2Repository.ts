import { v4 } from 'uuid';
import { OAuth2App } from '../interfaces/OAuth2App';
import { Oauth2User } from '../interfaces/User';
import { IDatabaseService } from '../services/DatabaseService';

export class OAuth2Repository {
  constructor(private db: IDatabaseService) {}

  private apps() {
    return this.db.from<OAuth2App>('oauth2_apps');
  }

  private codes() {
    return this.db.from<{ code: string; client_id: string; redirect_uri: string; user_id: string }>('oauth2_codes');
  }

  async createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App> {
    const client_id = v4();
    const client_secret = v4();
    const { error } = await this.apps().insert({ owner_id, client_id, client_secret, name, redirect_urls });
    if (error) throw error;
    return { owner_id, client_id, client_secret, name, redirect_urls };
  }

  async getApps(filters: { owner_id?: string; client_id?: string } = {}, select: string = '*'): Promise<OAuth2App[]> {
    let query = this.apps().select(select as any);
    if (filters.owner_id) query = query.eq('owner_id', filters.owner_id);
    if (filters.client_id) query = query.eq('client_id', filters.client_id);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(app => ({
      ...app,
      redirect_urls: typeof app.redirect_urls === 'string' ? JSON.parse(app.redirect_urls) : app.redirect_urls,
    }));
  }

  async getAppsByOwner(owner_id: string): Promise<OAuth2App[]> {
    return this.getApps({ owner_id });
  }

  async getFormattedAppsByOwner(owner_id: string): Promise<
    Array<{
      client_id: string;
      client_secret: string;
      name: string;
      redirect_urls: string[];
    }>
  > {
    const { data, error } = await this.apps().select('client_id, client_secret, name, redirect_urls').eq('owner_id', owner_id);
    if (error) throw error;
    return (data || []).map(app => ({
      client_id: app.client_id,
      client_secret: app.client_secret,
      name: app.name,
      redirect_urls: app.redirect_urls as string[],
    }));
  }

  async getAppByClientId(client_id: string): Promise<OAuth2App | null> {
    const apps = await this.getApps({ client_id });
    return apps[0] || null;
  }

  async getFormattedAppByClientId(client_id: string): Promise<{
    client_id: string;
    client_secret: string;
    name: string;
    redirect_urls: string[];
  } | null> {
    const { data, error } = await this.apps().select('client_id, client_secret, name, redirect_urls').eq('client_id', client_id).limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    const app = data[0];
    return {
      client_id: app.client_id,
      client_secret: app.client_secret,
      name: app.name,
      redirect_urls: app.redirect_urls as string[],
    };
  }

  async generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string> {
    const code = v4();
    const { error } = await this.codes().insert({ code, client_id, redirect_uri, user_id });
    if (error) throw error;
    return code;
  }

  async deleteApp(client_id: string, owner_id: string): Promise<void> {
    const { error } = await this.apps().delete().eq('client_id', client_id).eq('owner_id', owner_id);
    if (error) throw error;
  }

  async updateApp(client_id: string, owner_id: string, update: { name?: string; redirect_urls?: string[] }): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (update.name !== undefined) payload.name = update.name;
    if (update.redirect_urls !== undefined) payload.redirect_urls = update.redirect_urls;
    if (Object.keys(payload).length === 0) return;
    const { error } = await this.apps().update(payload).eq('client_id', client_id).eq('owner_id', owner_id);
    if (error) throw error;
  }

  async getUserByCode(code: string, client_id: string): Promise<Oauth2User | null> {
    // perform two-step lookup to avoid complex join logic
    const { data: codes, error: codeErr } = await this.codes().select('user_id').eq('code', code).eq('client_id', client_id).limit(1);
    if (codeErr) throw codeErr;
    if (!codes || codes.length === 0) return null;
    const userId = codes[0].user_id;

    const { data: users, error: userErr } = await this.db.from<Oauth2User>('users')
      .select('username, user_id, email, balance, verified, steam_username, steam_avatar_url, steam_id, discord_id, google_id')
      .eq('user_id', userId)
      .limit(1);
    if (userErr) throw userErr;
    return users && users.length ? users[0] : null;
  }
}

function buildUpdateFields(obj: Record<string, unknown>, mapping: Record<string, (v: unknown) => unknown> = {}) {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key in obj) {
    if (typeof obj[key] === 'undefined') continue;
    fields.push(`${key} = ?`);
    values.push(mapping[key] ? mapping[key](obj[key]) : obj[key]);
  }
  return { fields, values };
}
