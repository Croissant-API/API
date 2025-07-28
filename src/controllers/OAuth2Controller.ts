/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpPost,
  httpGet,
  httpDelete,
  httpPatch,
} from "inversify-express-utils";
import { IOAuth2Service } from "../services/OAuth2Service";
import { describe } from "../decorators/describe";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";

function handleError(res: Response, error: unknown, message: string, status = 500) {
  const msg = error instanceof Error ? error.message : String(error);
  res.status(status).send({ message, error: msg });
}

@controller("/oauth2")
export class OAuth2 {
  constructor(@inject("OAuth2Service") private oauth2Service: IOAuth2Service) {}

  // --- Application Management ---

  @describe({
    endpoint: "/oauth2/app/:client_id",
    method: "GET",
    description: "Get an OAuth2 app by client_id",
    params: { client_id: "The client_id of the app" },
    responseType: {
      client_id: "string",
      client_secret: "string",
      name: "string",
      redirect_urls: ["string"]
    },
    example: "GET /api/oauth2/app/123"
  })
  @httpGet("/app/:client_id")
  async getAppByClientId(req: Request, res: Response) {
    try {
      const { client_id } = req.params;
      const app = await this.oauth2Service.getFormattedAppByClientId(client_id);
      if (!app) return res.status(404).send({ message: "App not found" });
      res.send(app);
    } catch (error) {
      handleError(res, error, "Error fetching app");
    }
  }

  @describe({
    endpoint: "/oauth2/app",
    method: "POST",
    description: "Create a new OAuth2 app",
    body: {
      name: "Name of the app",
      redirect_urls: "Array of redirect URLs"
    },
    responseType: {
      client_id: "string",
      client_secret: "string"
    },
    example: 'POST /api/oauth2/app {"name": "My App", "redirect_urls": ["https://example.com/callback"]}',
    requiresAuth: true
  })
  @httpPost("/app", LoggedCheck.middleware)
  async createApp(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, redirect_urls } = req.body;
      if (!name || !redirect_urls || !Array.isArray(redirect_urls)) {
        return res.status(400).send({ message: "Invalid request body" });
      }
      const app = await this.oauth2Service.createApp(
        req.user.user_id,
        name,
        redirect_urls
      );
      res.status(201).send({ 
        client_id: app.client_id, 
        client_secret: app.client_secret 
      });
    } catch (error) {
      handleError(res, error, "Error creating app");
    }
  }

  @describe({
    endpoint: "/oauth2/apps",
    method: "GET",
    description: "Get all OAuth2 apps owned by the authenticated user",
    responseType: [{
      client_id: "string",
      client_secret: "string",
      name: "string",
      redirect_urls: ["string"]
    }],
    example: "GET /api/oauth2/apps",
    requiresAuth: true
  })
  @httpGet("/apps", LoggedCheck.middleware)
  async getMyApps(req: AuthenticatedRequest, res: Response) {
    try {
      const apps = await this.oauth2Service.getFormattedAppsByOwner(req.user.user_id);
      res.send(apps);
    } catch (error) {
      handleError(res, error, "Error fetching apps");
    }
  }

  @describe({
    endpoint: "/oauth2/app/:client_id",
    method: "PATCH",
    description: "Update an OAuth2 app",
    params: { client_id: "The client_id of the app" },
    body: {
      name: "Name of the app (optional)",
      redirect_urls: "Array of redirect URLs (optional)"
    },
    responseType: { success: "boolean" },
    example: 'PATCH /api/oauth2/app/123 {"name": "Updated App"}',
    requiresAuth: true
  })
  @httpPatch("/app/:client_id", LoggedCheck.middleware)
  async updateApp(req: AuthenticatedRequest, res: Response) {
    try {
      const { client_id } = req.params;
      const { name, redirect_urls } = req.body;
      const userId = req.user.user_id;
      
      await this.oauth2Service.updateApp(client_id, userId, {
        name,
        redirect_urls,
      });
      res.status(200).send({ success: true });
    } catch (error) {
      handleError(res, error, "Error updating app");
    }
  }

  @describe({
    endpoint: "/oauth2/app/:client_id",
    method: "DELETE",
    description: "Delete an OAuth2 app",
    params: { client_id: "The client_id of the app" },
    responseType: { message: "string" },
    example: "DELETE /api/oauth2/app/123",
    requiresAuth: true
  })
  @httpDelete("/app/:client_id", LoggedCheck.middleware)
  async deleteApp(req: AuthenticatedRequest, res: Response) {
    try {
      const { client_id } = req.params;
      const userId = req.user.user_id;
      await this.oauth2Service.deleteApp(client_id, userId);
      res.status(204).send();
    } catch (error) {
      handleError(res, error, "Error deleting app");
    }
  }

  // --- Authorization & User ---

  @describe({
    endpoint: "/oauth2/authorize",
    method: "GET",
    description: "Authorize a user for an OAuth2 app",
    query: {
      client_id: "The client_id of the app",
      redirect_uri: "The redirect URI"
    },
    responseType: { code: "string" },
    example: "GET /api/oauth2/authorize?client_id=123&redirect_uri=https://example.com/callback",
    requiresAuth: true
  })
  @httpGet("/authorize", LoggedCheck.middleware)
  async authorize(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).send({ message: "Unauthorized" });
      }
      const { client_id, redirect_uri } = req.query as any;
      if (!client_id || !redirect_uri) {
        return res.status(400).send({ message: "Missing client_id or redirect_uri" });
      }
      
      const code = await this.oauth2Service.generateAuthCode(
        client_id,
        redirect_uri,
        userId
      );
      res.send({ code });
    } catch (error) {
      handleError(res, error, "Error generating authorization code");
    }
  }

  @describe({
    endpoint: "/oauth2/user",
    method: "GET",
    description: "Get user information by authorization code",
    query: {
      code: "The authorization code",
      client_id: "The client_id of the app"
    },
    responseType: {
      username: "string",
      user_id: "string",
      email: "string",
      balance: "number",
      verified: "boolean",
      steam_username: "string",
      steam_avatar_url: "string",
      steam_id: "string"
    },
    example: "GET /api/oauth2/user?code=abc123&client_id=456"
  })
  @httpGet("/user")
  async getUserByCode(req: Request, res: Response) {
    try {
      const { code, client_id } = req.query as any;
      if (!code || !client_id) {
        return res.status(400).send({ message: "Missing code or client_id" });
      }
      
      const user = await this.oauth2Service.getUserByCode(code, client_id);
      if (!user) return res.status(404).send({ message: "User not found" });
      
      res.send(user);
    } catch (error) {
      handleError(res, error, "Error fetching user");
    }
  }
}
