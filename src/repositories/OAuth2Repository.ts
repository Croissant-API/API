import { v4 } from 'uuid';
import { OAuth2App } from '../interfaces/OAuth2App';
import { Oauth2User } from '../interfaces/User';
import { IDatabaseService } from '../services/DatabaseService';

export class OAuth2Repository {
  constructor(private db: IDatabaseService) {}

  async createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App> {
    const client_id = v4();
    const client_secret = v4();
    const db = await this.db.getDb();
    await db.collection('oauth2_apps').insertOne({
      owner_id,
      client_id,
      client_secret,
      name,
      redirect_urls
    });
    return { owner_id, client_id, client_secret, name, redirect_urls };
  }

  async getApps(filters: { owner_id?: string; client_id?: string } = {}, select: string = '*'): Promise<OAuth2App[]> {
    const db = await this.db.getDb();
    const query: any = {};
    if (filters.owner_id) query.owner_id = filters.owner_id;
    if (filters.client_id) query.client_id = filters.client_id;
    const docs = await db.collection('oauth2_apps').find(query).toArray();
    const apps: OAuth2App[] = docs.map(doc => ({
      owner_id: doc.owner_id,
      client_id: doc.client_id,
      client_secret: doc.client_secret,
      name: doc.name,
      redirect_urls: doc.redirect_urls
    }));
    return apps;
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
    const db = await this.db.getDb();
    const apps = await db.collection('oauth2_apps')
      .find({ owner_id })
      .project({ client_id: 1, client_secret: 1, name: 1, redirect_urls: 1, _id: 0 })
      .toArray() as OAuth2App[];
    return apps.map(app => ({
      client_id: app.client_id,
      client_secret: app.client_secret,
      name: app.name,
      redirect_urls: app.redirect_urls,
    }));
  }

  async getAppByClientId(client_id: string): Promise<OAuth2App | null> {
    const db = await this.db.getDb();
    const app = await db.collection('oauth2_apps').findOne({ client_id });
    if (!app) return null;
    return {
      owner_id: app.owner_id,
      client_id: app.client_id,
      client_secret: app.client_secret,
      name: app.name,
      redirect_urls: app.redirect_urls
    };
  }

  async getFormattedAppByClientId(client_id: string): Promise<{
    client_id: string;
    client_secret: string;
    name: string;
    redirect_urls: string[];
  } | null> {
    const db = await this.db.getDb();
    const app = await db.collection('oauth2_apps')
      .findOne({ client_id }, { projection: { client_id: 1, client_secret: 1, name: 1, redirect_urls: 1, _id: 0 } });
    if (!app) return null;
    return app as any;
  }

  async generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string> {
    const code = v4();
    const db = await this.db.getDb();
    await db.collection('oauth2_codes').insertOne({ code, client_id, redirect_uri, user_id });
    return code;
  }

  async deleteApp(client_id: string, owner_id: string): Promise<void> {
    const db = await this.db.getDb();
    await db.collection('oauth2_apps').deleteOne({ client_id, owner_id });
  }

  async updateApp(client_id: string, owner_id: string, update: { name?: string; redirect_urls?: string[] }): Promise<void> {
    const db = await this.db.getDb();
    const set: any = {};
    if (update.name !== undefined) set.name = update.name;
    if (update.redirect_urls !== undefined) set.redirect_urls = update.redirect_urls;
    if (Object.keys(set).length === 0) return;
    await db.collection('oauth2_apps').updateOne({ client_id, owner_id }, { $set: set });
  }

  async getUserByCode(code: string, client_id: string): Promise<Oauth2User | null> {
    const db = await this.db.getDb();
    const result = await db.collection('oauth2_codes').aggregate([
      { $match: { code, client_id } },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'user_id',
          as: 'userData'
        }
      },
      { $unwind: '$userData' },
      { $replaceRoot: { newRoot: '$userData' } },
      { $project: { _id: 0 } }
    ]).toArray() as Oauth2User[];
    return result[0] || null;
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
