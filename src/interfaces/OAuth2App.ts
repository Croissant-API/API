export interface OAuth2App {
    id?: number;
    owner_id: string;
    client_id: string; // Unique snowflake/uuid, not owner_id
    client_secret: string;
    name: string;
    redirect_urls: string; // JSON.stringify(string[])
}