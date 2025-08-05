import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { OAuth2App } from "../interfaces/OAuth2App";
import { v4 as uuidv4 } from "uuid";
import { Oauth2User } from "../interfaces/User";

export interface IOAuth2Service {
    createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App>;
    getAppsByOwner(owner_id: string): Promise<OAuth2App[]>;
    getAppByClientId(client_id: string): Promise<OAuth2App | null>;
    generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string>;
    deleteApp(client_id: string, owner_id: string): Promise<void>;
    updateApp(client_id: string, owner_id: string, update: { name?: string, redirect_urls?: string[] }): Promise<void>;
    getUserByCode(code: string, client_id: string): Promise<Oauth2User | null>;
    getFormattedAppsByOwner(owner_id: string): Promise<Array<{
        client_id: string;
        client_secret: string;
        name: string;
        redirect_urls: string[];
    }>>;
    getFormattedAppByClientId(client_id: string): Promise<{
        client_id: string;
        client_secret: string;
        name: string;
        redirect_urls: string[];
    } | null>;
}

@injectable()
export class OAuth2Service implements IOAuth2Service {
    private readonly oauth2AppsTable = 'oauth2_apps';
    private readonly oauth2CodesTable = 'oauth2_codes';
    private readonly usersTable = 'users';

    constructor(@inject("DatabaseService") private db: IDatabaseService) {}

    async createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App> {
        const knex = this.db.getKnex();
        const client_id = uuidv4();
        const client_secret = uuidv4();

        try {
            await knex(this.oauth2AppsTable).insert({
                owner_id,
                client_id,
                client_secret,
                name,
                redirect_urls: JSON.stringify(redirect_urls)
            });

            return { owner_id, client_id, client_secret, name, redirect_urls };
        } catch (error) {
            console.error("Error creating OAuth2 app:", error);
            throw error;
        }
    }

    async getAppsByOwner(owner_id: string): Promise<OAuth2App[]> {
        const knex = this.db.getKnex();

        try {
            const apps = await knex(this.oauth2AppsTable)
                .where({ owner_id });

            return apps.map(app => ({
                ...app,
                redirect_urls: JSON.parse(app.redirect_urls)
            }));
        } catch (error) {
            console.error("Error getting OAuth2 apps by owner:", error);
            throw error;
        }
    }

    async getFormattedAppsByOwner(owner_id: string): Promise<Array<{
        client_id: string;
        client_secret: string;
        name: string;
        redirect_urls: string[];
    }>> {
        const knex = this.db.getKnex();

        try {
            const apps = await knex(this.oauth2AppsTable)
                .select('client_id', 'client_secret', 'name', 'redirect_urls')
                .where({ owner_id });

            return apps.map(app => ({
                client_id: app.client_id,
                client_secret: app.client_secret,
                name: app.name,
                redirect_urls: JSON.parse(app.redirect_urls)
            }));
        } catch (error) {
            console.error("Error getting formatted OAuth2 apps by owner:", error);
            throw error;
        }
    }

    async getAppByClientId(client_id: string): Promise<OAuth2App | null> {
        const knex = this.db.getKnex();

        try {
            const app = await knex(this.oauth2AppsTable)
                .where({ client_id })
                .first();

            if (!app) return null;

            return {
                ...app,
                redirect_urls: JSON.parse(app.redirect_urls)
            };
        } catch (error) {
            console.error("Error getting OAuth2 app by client ID:", error);
            throw error;
        }
    }

    async getFormattedAppByClientId(client_id: string): Promise<{
        client_id: string;
        client_secret: string;
        name: string;
        redirect_urls: string[];
    } | null> {
        const knex = this.db.getKnex();

        try {
            const app = await knex(this.oauth2AppsTable)
                .select('client_id', 'client_secret', 'name', 'redirect_urls')
                .where({ client_id })
                .first();

            if (!app) return null;

            return {
                client_id: app.client_id,
                client_secret: app.client_secret,
                name: app.name,
                redirect_urls: JSON.parse(app.redirect_urls)
            };
        } catch (error) {
            console.error("Error getting formatted OAuth2 app by client ID:", error);
            throw error;
        }
    }

    async generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string> {
        const knex = this.db.getKnex();
        const code = uuidv4();

        try {
            await knex(this.oauth2CodesTable).insert({
                code,
                client_id,
                redirect_uri,
                user_id
            });

            return code;
        } catch (error) {
            console.error("Error generating auth code:", error);
            throw error;
        }
    }

    async deleteApp(client_id: string, owner_id: string): Promise<void> {
        const knex = this.db.getKnex();

        try {
            await knex(this.oauth2AppsTable)
                .where({ client_id, owner_id })
                .delete();
        } catch (error) {
            console.error("Error deleting OAuth2 app:", error);
            throw error;
        }
    }

    async updateApp(client_id: string, owner_id: string, update: { name?: string, redirect_urls?: string[] }): Promise<void> {
        const knex = this.db.getKnex();

        try {
            const updateData: { name?: string, redirect_urls?: string } = {};

            if (update.name) {
                updateData.name = update.name;
            }

            if (update.redirect_urls) {
                updateData.redirect_urls = JSON.stringify(update.redirect_urls);
            }

            await knex(this.oauth2AppsTable)
                .where({ client_id, owner_id })
                .update(updateData);
        } catch (error) {
            console.error("Error updating OAuth2 app:", error);
            throw error;
        }
    }

    async getUserByCode(code: string, client_id: string): Promise<Oauth2User | null> {
        const knex = this.db.getKnex();

        try {
            const user = await knex(this.oauth2CodesTable + ' as c')
                .join(this.oauth2AppsTable + ' as a', 'c.client_id', 'a.client_id')
                .join(this.usersTable + ' as u', 'c.user_id', 'u.user_id')
                .select(
                    'u.username',
                    'u.user_id',
                    'u.email',
                    'u.balance',
                    'u.verified',
                    'u.steam_username',
                    'u.steam_avatar_url',
                    'u.steam_id',
                    'u.discord_id',
                    'u.google_id'
                )
                .where({ 'c.code': code, 'c.client_id': client_id })
                .first();

            return user || null;
        } catch (error) {
            console.error("Error getting user by code:", error);
            throw error;
        }
    }
}
