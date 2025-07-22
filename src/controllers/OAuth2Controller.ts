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

@controller("/oauth2")
export class OAuth2 {
  constructor(@inject("OAuth2Service") private oauth2Service: IOAuth2Service) {}

  // --- Application Management ---

  @httpGet("/app/:client_id")
  async getAppByClientId(req: Request, res: Response) {
    const { client_id } = req.params;
    const app = await this.oauth2Service.getAppByClientId(client_id);
    if (!app) return res.status(404).send({ message: "App not found" });
    res.send({
      client_id: app.client_id,
      client_secret: app.client_secret,
      name: app.name,
      redirect_urls: JSON.parse(app.redirect_urls),
    });
  }

  @httpPost("/app", LoggedCheck.middleware)
  async createApp(req: AuthenticatedRequest, res: Response) {
    const { name, redirect_urls } = req.body;
    const app = await this.oauth2Service.createApp(
      req.user.user_id,
      name,
      redirect_urls
    );
    res
      .status(201)
      .send({ client_id: app.client_id, client_secret: app.client_secret });
  }

  @httpGet("/apps", LoggedCheck.middleware)
  async getMyApps(req: AuthenticatedRequest, res: Response) {
    const apps = await this.oauth2Service.getAppsByOwner(req.user.user_id);
    res.send(
      apps.map((a) => ({
        client_id: a.client_id,
        client_secret: a.client_secret,
        name: a.name,
        redirect_urls: JSON.parse(a.redirect_urls),
      }))
    );
  }

  @httpPatch("/app/:client_id", LoggedCheck.middleware)
  async updateApp(req: AuthenticatedRequest, res: Response) {
    const { client_id } = req.params;
    const { name, redirect_urls } = req.body;
    const userId = req.user.user_id;
    await this.oauth2Service.updateApp(client_id, userId, {
      name,
      redirect_urls,
    });
    res.status(200).send({ success: true });
  }

  @httpDelete("/app/:client_id", LoggedCheck.middleware)
  async deleteApp(req: AuthenticatedRequest, res: Response) {
    const { client_id } = req.params;
    const userId = req.user.user_id;
    await this.oauth2Service.deleteApp(client_id, userId);
    res.status(204).send();
  }

  // --- Authorization & User ---

  @httpGet("/authorize", LoggedCheck.middleware)
  async authorize(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    const { client_id, redirect_uri } = req.query as any;
    if (!client_id || !redirect_uri || !userId)
      return res.status(400).send({ message: "Missing params" });
    const code = await this.oauth2Service.generateAuthCode(
      client_id,
      redirect_uri,
      userId
    );
    res.send({ code });
  }

  @describe({
    endpoint: "/oauth2/user",
    method: "GET",
    description: "Get user by code",
    query: {
      code: "string",
      client_id: "string",
      client_secret: "string",
      redirect_uri: "string",
    },
    responseType: { user: "object" },
  })
  @httpGet("/user")
  async getUserByCode(req: Request, res: Response) {
    const { code, client_id } = req.query as any;
    if (!code || !client_id) {
      return res.status(400).send({ message: "Missing params" });
    }
    const user = await this.oauth2Service.getUserByCode(
      code,
      client_id
    );
    if (!user) return res.status(404).send({ message: "User not found" });
    res.send(user);
  }
}
