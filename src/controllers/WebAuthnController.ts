/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { controller, httpPost } from "inversify-express-utils";
import { inject } from "inversify";
import { Request, Response } from "express";
import { IUserService } from "../services/UserService";
import { getAuthenticationOptions, getRegistrationOptions, verifyRegistration } from "../lib/webauthnService";
import { genKey } from "../utils/GenKey";
import { ILogService } from "../services/LogService"; // Ajout import LogService

@controller("/webauthn")
export class WebAuthn {
  constructor(
    @inject("UserService") private userService: IUserService,
    @inject("LogService") private logService: ILogService // Injection LogService
  ) { }

  // Helper pour créer des logs
  private async createLog(req: Request, controller: string, tableName?: string, statusCode?: number, userId?: string) {
    try {
      await this.logService.createLog({
        ip_address: req.headers["x-real-ip"] as string || req.socket.remoteAddress as string,
        table_name: tableName,
        controller: `WebAuthnController.${controller}`,
        original_path: req.originalUrl,
        http_method: req.method,
        request_body: req.body,
        user_id: userId,
        status_code: statusCode
      });
    } catch (error) {
      // Ne jamais bloquer la route sur une erreur de log
      console.error('Error creating log:', error);
    }
  }

  @httpPost("/register/options")
  async getRegistrationOptions(req: Request, res: Response) {
    const userId = req.body.userId as string;
    if (!userId) {
      await this.createLog(req, 'getRegistrationOptions', 'users', 400);
      return res.status(400).json({ message: "User ID is required" });
    }
    try {
      const options = await getRegistrationOptions(userId);
      // Encode challenge en base64 pour le front
      const challengeBase64 = Buffer.from(options.challenge).toString('base64');
      await this.userService.updateWebauthnChallenge(userId, challengeBase64); // <-- stocke en base64
      options.challenge = challengeBase64;
      options.user.id = Buffer.from(options.user.id).toString('base64');
      await this.createLog(req, 'getRegistrationOptions', 'users', 200, userId);
      res.status(200).json(options);
    } catch (error) {
      await this.createLog(req, 'getRegistrationOptions', 'users', 500, userId);
      res.status(500).json({ message: "Error generating registration options" });
    }
  }

  @httpPost("/register/verify")
  async verifyRegistration(req: Request, res: Response) {
    const { credential, userId } = req.body;
    if (!credential) {
      await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
      return res.status(400).json({ message: "Credential is required" });
    }
    try {
      const user = await this.userService.getUser(userId);
      const expectedChallenge = user?.webauthn_challenge;
      if (!expectedChallenge) {
        await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
        return res.status(400).json({ message: "No challenge found" });
      }

      // Si tu stockes en base64, il faut le convertir en base64url si le front utilise base64url
      function base64ToBase64url(str: string) {
        return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      }
      const expectedChallengeBase64url = base64ToBase64url(expectedChallenge);

      const verification = await verifyRegistration({ credential }, expectedChallengeBase64url);
      if (verification) {
        await this.userService.updateWebauthnChallenge(credential.id, null);
        await this.userService.addWebauthnCredential(userId, {
          id: credential.id,
          name: credential.name || "Default Name",
          created_at: new Date(),
        });
        await this.createLog(req, 'verifyRegistration', 'users', 200, userId);
        return res.status(200).json({ message: "Registration successful" });
      } else {
        await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
        return res.status(400).json({ message: "Registration verification failed" });
      }
    } catch (error) {
      await this.createLog(req, 'verifyRegistration', 'users', 500, userId);
      res.status(500).json({ message: "Error verifying registration" });
    }
  }

  @httpPost("/authenticate/options")
  async getAuthenticationOptionsHandler(req: Request, res: Response) {
    const userId = req.body.userId as string;
    let credentials: any[] = [];
    try {
      if (userId) {
        const user = await this.userService.getUser(userId);
        credentials = JSON.parse(user?.webauthn_credentials || "[]");
      } else {
        // Si pas d'userId, retourne les options sans credentials (découverte par le navigateur)
        credentials = [];
      }
      const options = await getAuthenticationOptions(credentials);
      const challengeBase64 = Buffer.from(options.challenge).toString('base64');
      await this.userService.updateWebauthnChallenge(userId, challengeBase64);
      options.challenge = challengeBase64;
      await this.createLog(req, 'getAuthenticationOptionsHandler', 'users', 200, userId);
      res.status(200).json(options);
    } catch (error) {
      await this.createLog(req, 'getAuthenticationOptionsHandler', 'users', 500, userId);
      res.status(500).json({ message: "Error generating authentication options" });
    }
  }

  @httpPost("/authenticate/verify")
  async verifyAuthenticationHandler(req: Request, res: Response) {
    const { credential, userId } = req.body;
    if (!credential) {
      await this.createLog(req, 'verifyAuthenticationHandler', 'users', 400, userId);
      return res.status(400).json({ message: "Credential is required" });
    }
    try {
      credential.id = credential.id.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); // Assure que l'ID est en base64url

      // Si pas d'userId, retrouve l'utilisateur par credential.id
      let user;
      if (userId) {
        user = await this.userService.getUser(userId);
      } else if (credential.id) {
        user = await this.userService.getUserByCredentialId(credential.id);
      }
      if (!user) {
        await this.createLog(req, 'verifyAuthenticationHandler', 'users', 404, userId);
        return res.status(404).json({ message: "User not found" });
      }

      const token = genKey(user.user_id);

      await this.createLog(req, 'verifyAuthenticationHandler', 'users', 200, user.user_id);
      res.status(200).json({ message: "Authentication successful", token });
    } catch (error) {
      await this.createLog(req, 'verifyAuthenticationHandler', 'users', 500, userId);
      res.status(500).json({ message: "Error verifying authentication" });
    }
  }
}
