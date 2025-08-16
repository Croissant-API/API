import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { OAuth2App } from "../interfaces/OAuth2App";
import { Oauth2User } from "../interfaces/User";
import { OAuth2Repository } from "../repositories/OAuth2Repository";

export interface IOAuth2Service {
    createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App>;
    getAppsByOwner(owner_id: string): Promise<OAuth2App[]>;
    getAppByClientId(client_id: string): Promise<OAuth2App | null>;
    generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string>;
    deleteApp(client_id: string, owner_id: string): Promise<void>;
    updateApp(client_id: string, owner_id: string, update: { name?: string, redirect_urls?: string[] }): Promise<void>;
    getUserByCode(code: string, client_id: string): Promise<Oauth2User | null>;
}

@injectable()
export class OAuth2Service implements IOAuth2Service {
    private oauth2Repository: OAuth2Repository;
    constructor(@inject("DatabaseService") private db: IDatabaseService) {
        this.oauth2Repository = new OAuth2Repository(this.db);
    }

    async createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App> {
        return this.oauth2Repository.createApp(owner_id, name, redirect_urls);
    }

    async getAppsByOwner(owner_id: string): Promise<OAuth2App[]> {
        return this.oauth2Repository.getAppsByOwner(owner_id);
    }

    async getAppByClientId(client_id: string): Promise<OAuth2App | null> {
        return this.oauth2Repository.getAppByClientId(client_id);
    }

    async generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string> {
        return this.oauth2Repository.generateAuthCode(client_id, redirect_uri, user_id);
    }

    async deleteApp(client_id: string, owner_id: string): Promise<void> {
        await this.oauth2Repository.deleteApp(client_id, owner_id);
    }

    async updateApp(client_id: string, owner_id: string, update: { name?: string, redirect_urls?: string[] }): Promise<void> {
        await this.oauth2Repository.updateApp(client_id, owner_id, update);
    }

    async getUserByCode(code: string, client_id: string): Promise<Oauth2User | null> {
        return this.oauth2Repository.getUserByCode(code, client_id);
    }
}
