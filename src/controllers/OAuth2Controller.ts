/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpPost, httpGet, httpDelete, httpPatch } from "inversify-express-utils";
import { IOAuth2Service } from "../services/OAuth2Service";
import { describe } from "../decorators/describe";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";

@controller("/oauth2")
export class OAuth2 {
    constructor(@inject("OAuth2Service") private oauth2Service: IOAuth2Service) {}

    @httpGet("/app/:client_id")
    async getAppByClientId(req: Request, res: Response) {
        const { client_id } = req.params;
        const app = await this.oauth2Service.getAppByClientId(client_id);
        if (!app) return res.status(404).send({ message: "App not found" });
        // On parse les redirect_urls pour retourner un tableau
        res.send({
            client_id: app.client_id,
            client_secret: app.client_secret,
            name: app.name,
            redirect_urls: JSON.parse(app.redirect_urls)
        });
    }

    // @describe({
    //     endpoint: "/oauth2/app",
    //     method: "POST",
    //     description: "Créer une application OAuth2",
    //     body: { name: "Nom de l'app", redirect_urls: "Array<string>" },
    //     responseType: { client_id: "string", client_secret: "string" },
    //     requiresAuth: true
    // })
    @httpPost("/app", LoggedCheck.middleware)
    async createApp(req: AuthenticatedRequest, res: Response) {
        const { name, redirect_urls } = req.body;
        const app = await this.oauth2Service.createApp(req.user.user_id, name, redirect_urls);
        res.status(201).send({ client_id: app.client_id, client_secret: app.client_secret });
    }

    // @describe({
    //     endpoint: "/oauth2/apps",
    //     method: "GET",
    //     description: "Lister mes applications OAuth2",
    //     responseType: [{ client_id: "string", name: "string", redirect_urls: "string[]" }],
    //     requiresAuth: true
    // })
    @httpGet("/apps", LoggedCheck.middleware)
    async getMyApps(req: AuthenticatedRequest, res: Response) {
        const apps = await this.oauth2Service.getAppsByOwner(req.user.user_id);
        res.send(apps.map(a => ({
            client_id: a.client_id,
            client_secret: a.client_secret, // Ajout ici
            name: a.name,
            redirect_urls: JSON.parse(a.redirect_urls)
        })));
    }

    // @describe({
    //     endpoint: "/oauth2/authorize",
    //     method: "GET",
    //     description: "Générer un code d'auth (flow code)",
    //     query: { client_id: "string", redirect_uri: "string" },
    //     responseType: { code: "string" }
    // })
    @httpGet("/authorize", LoggedCheck.middleware)
    async authorize(req: AuthenticatedRequest, res: Response) {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const { client_id, redirect_uri } = req.query as any;
        if (!client_id || !redirect_uri || !userId) return res.status(400).send({ message: "Missing params" });
        const code = await this.oauth2Service.generateAuthCode(client_id, redirect_uri, userId);
        res.send({ code });
    }

    // Get user by code
    @describe({
        endpoint: "/oauth2/user",
        method: "GET",
        description: "Get user by code",
        query: { code: "string", client_id: "string", client_secret: "string", redirect_uri: "string" },
        responseType: { user: "object" }
    })
    @httpGet("/user", LoggedCheck.middleware)
    async getUserByCode(req: AuthenticatedRequest, res: Response) {
        const { code, client_id, client_secret } = req.query as any;
        if (!code || !client_id || !client_secret) {
            return res.status(400).send({ message: "Missing params" });
        }
        const user = await this.oauth2Service.getUserByCode(code, client_id, client_secret);
        if (!user) return res.status(404).send({ message: "User not found" });
        res.send(user);
    }

    // @describe({
    //     endpoint: "/oauth2/token",
    //     method: "POST",
    //     description: "Échanger un code contre un token",
    //     body: { code: "string", client_id: "string", client_secret: "string", redirect_uri: "string" },
    //     responseType: { access_token: "string" }
    // })
    // @httpPost("/token")
    // async token(req: Request, res: Response) {
    //     const { code, client_id, client_secret, redirect_uri } = req.body;
    //     const token = await this.oauth2Service.exchangeCodeForToken(code, client_id, client_secret, redirect_uri);
    //     if (!token) return res.status(400).send({ message: "Invalid code or credentials" });
    //     res.send({ access_token: token });
    // }

    @httpDelete("/app/:client_id", LoggedCheck.middleware)
    async deleteApp(req: AuthenticatedRequest, res: Response) {
        const { client_id } = req.params;
        const userId = req.user.user_id;
        await this.oauth2Service.deleteApp(client_id, userId);
        res.status(204).send();
    }

    @httpPatch("/app/:client_id", LoggedCheck.middleware)
    async updateApp(req: AuthenticatedRequest, res: Response) {
        const { client_id } = req.params;
        const { name, redirect_urls } = req.body;
        const userId = req.user.user_id;
        await this.oauth2Service.updateApp(client_id, userId, { name, redirect_urls });
        res.status(200).send({ success: true });
    }
}