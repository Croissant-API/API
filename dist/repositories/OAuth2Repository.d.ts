import { OAuth2App } from "../interfaces/OAuth2App";
import { Oauth2User } from "../interfaces/User";
import { IDatabaseService } from "../services/DatabaseService";
export declare class OAuth2Repository {
    private db;
    constructor(db: IDatabaseService);
    createApp(owner_id: string, name: string, redirect_urls: string[]): Promise<OAuth2App>;
    getApps(filters?: {
        owner_id?: string;
        client_id?: string;
    }, select?: string): Promise<OAuth2App[]>;
    getAppsByOwner(owner_id: string): Promise<OAuth2App[]>;
    getFormattedAppsByOwner(owner_id: string): Promise<Array<{
        client_id: string;
        client_secret: string;
        name: string;
        redirect_urls: string[];
    }>>;
    getAppByClientId(client_id: string): Promise<OAuth2App | null>;
    getFormattedAppByClientId(client_id: string): Promise<{
        client_id: string;
        client_secret: string;
        name: string;
        redirect_urls: string[];
    } | null>;
    generateAuthCode(client_id: string, redirect_uri: string, user_id: string): Promise<string>;
    deleteApp(client_id: string, owner_id: string): Promise<void>;
    updateApp(client_id: string, owner_id: string, update: {
        name?: string;
        redirect_urls?: string[];
    }): Promise<void>;
    getUserByCode(code: string, client_id: string): Promise<Oauth2User | null>;
}

