/* eslint-disable @typescript-eslint/no-explicit-any */
import { controller, httpPost } from "inversify-express-utils";
import { inject } from "inversify";
import { Request, Response } from "express";
import { IUserService } from "../services/UserService";
import { getAuthenticationOptions, getRegistrationOptions, verifyRegistration } from "../lib/webauthnService";
import { genKey } from "../utils/GenKey";

@controller("/webauthn")
export class WebAuthn {
  constructor(@inject("UserService") private userService: IUserService) { }

  @httpPost("/register/options")
  async getRegistrationOptions(req: Request, res: Response) {
    const userId = req.body.userId as string;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const options = await getRegistrationOptions(userId);
    // Encode challenge en base64 pour le front
    const challengeBase64 = Buffer.from(options.challenge).toString('base64');
    await this.userService.updateWebauthnChallenge(userId, challengeBase64); // <-- stocke en base64
    options.challenge = challengeBase64;
    options.user.id = Buffer.from(options.user.id).toString('base64');
    res.status(200).json(options);
  }

  @httpPost("/register/verify")
  async verifyRegistration(req: Request, res: Response) {
    const { credential, userId } = req.body;
    if (!credential) {
      return res.status(400).json({ message: "Credential is required" });
    }
    const user = await this.userService.getUser(userId);
    const expectedChallenge = user?.webauthn_challenge;
    if (!expectedChallenge) return res.status(400).json({ message: "No challenge found" });

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
      return res.status(200).json({ message: "Registration successful" });
    } else {
      return res.status(400).json({ message: "Registration verification failed" });
    }
  }


  @httpPost("/authenticate/options")
  async getAuthenticationOptionsHandler(req: Request, res: Response) {
    const userId = req.body.userId as string;
    let credentials: any[] = [];
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
    res.status(200).json(options);
  }

  @httpPost("/authenticate/verify")
  async verifyAuthenticationHandler(req: Request, res: Response) {
    const { credential, userId } = req.body;
    if (!credential) {
      return res.status(400).json({ message: "Credential is required" });
    }

    credential.id = credential.id.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); // Assure que l'ID est en base64url

    // Si pas d'userId, retrouve l'utilisateur par credential.id
    let user;
    if (userId) {
      user = await this.userService.getUser(userId);
    } else if (credential.id) {
      user = await this.userService.getUserByCredentialId(credential.id);
    }
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = genKey(user.user_id);

    res.status(200).json({ message: "Authentication successful", token });
  }
}
