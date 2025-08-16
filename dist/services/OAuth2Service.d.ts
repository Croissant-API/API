import { IDatabaseService } from "./DatabaseService";
import { OAuth2App } from "../interfaces/OAuth2App";
import { Oauth2User } from "../interfaces/User";
export interface IOAuth2Service {
    createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App>;
    getAppsByOwner(owner_id: string): Promise<OAuth2App[]>;
    getAppByClientId(client_id: string): Promise<OAuth2App | null>;
    generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string>;
    deleteApp(client_id: string, owner_id: string): Promise<void>;
    updateApp(client_id: string, owner_id: string, update: {
        name?: string;
        redirect_urls?: string[];
    }): Promise<void>;
    getUserByCode(code: string, client_id: string): Promise<Oauth2User | null>;
}
export declare class OAuth2Service implements IOAuth2Service {
    private db;
    private oauth2Repository;
    constructor(db: IDatabaseService);
    createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App>;
    getAppsByOwner(owner_id: string): Promise<OAuth2App[]>;
    getAppByClientId(client_id: string): Promise<OAuth2App | null>;
    generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string>;
    deleteApp(client_id: string, owner_id: string): Promise<void>;
    updateApp(client_id: string, owner_id: string, update: {
        name?: string;
        redirect_urls?: string[];
    }): Promise<void>;
    getUserByCode(code: string, client_id: string): Promise<Oauth2User | null>;
}
