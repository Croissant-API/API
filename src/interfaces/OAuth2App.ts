export interface OAuth2App {
  id?: number;
  owner_id: string;
  client_id: string;
  client_secret: string;
  name: string;
  redirect_urls: string;
}
