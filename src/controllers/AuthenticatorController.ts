import { controller, httpPost } from "inversify-express-utils";
import { inject } from "inversify";
import { Request, Response } from "express";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import * as qrcode from "qrcode";
import { Totp } from "time2fa";
import { genKey } from "../utils/GenKey";
import { IUserService } from "../services/UserService";
import { ILogService } from "../services/LogService";
import { generateUserJwt } from "../utils/Jwt";

// --- UTILS ---
function handleError(res: Response, error: unknown, message: string, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}

@controller("/authenticator")
export class Authenticator {
    constructor(
        @inject("UserService") private userService: IUserService,
        @inject("LogService") private logService: ILogService // décommenté pour logger
    ) { }

    // Helper pour les logs (utilise logService maintenant)
    private async logAction(
        req: Request,
        action: string,
        statusCode: number,
        metadata?: object
    ) {
        try {
            const requestBody = { ...req.body };
            if (metadata) requestBody.metadata = metadata;
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] as string || req.socket.remoteAddress as string,
                table_name: "authenticator",
                controller: `AuthenticatorController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: (req as AuthenticatedRequest).user?.user_id,
                status_code: statusCode
            });
        } catch (error) {
            console.error('Error creating log:', error);
        }
    }

    @httpPost("/generateKey", LoggedCheck.middleware)
    async generateKey(req: AuthenticatedRequest, res: Response) {
        const user = req.user;
        if (!user || !user.email) {
            await this.logAction(req, "generateKey", 400);
            return res.status(400).send({ message: "User not authenticated or email missing" });
        }
        try {
            const key = Totp.generateKey({ issuer: "Croissant API", user: user.email });
            qrcode.toDataURL(key.url, async (err: unknown, url: string) => {
                if (err) {
                    await this.logAction(req, "generateKey", 500, { error: err });
                    return res.status(500).send({ message: "Error generating QR code" });
                }
                await this.logAction(req, "generateKey", 200);
                res.status(200).send({ key, qrCode: url });
            });
        } catch (error) {
            await this.logAction(req, "generateKey", 500, { error });
            handleError(res, error, "Error generating key");
        }
    }

    @httpPost("/registerKey", LoggedCheck.middleware)
    async registerKey(req: AuthenticatedRequest, res: Response) {
        const user = req.user;
        const { key, passcode } = req.body;
        if (!user || !user.email || !key) {
            await this.logAction(req, "registerKey", 400);
            return res.status(400).send({ message: "User not authenticated, email missing, or key missing" });
        }
        if (!passcode) {
            await this.logAction(req, "registerKey", 400);
            return res.status(400).send({ message: "Passcode is required" });
        }
        try {
            const isValid = Totp.validate({ secret: key.secret, passcode });
            if (!isValid) {
                await this.logAction(req, "registerKey", 400);
                return res.status(400).send({ message: "Invalid passcode" });
            }
            await this.userService.setAuthenticatorSecret(user.user_id, key.secret);
            await this.logAction(req, "registerKey", 200);
            res.status(200).send({ message: "Key registered successfully" });
        } catch (error) {
            await this.logAction(req, "registerKey", 500, { error });
            handleError(res, error, "Error registering key");
        }
    }

    @httpPost("/verifyKey")
    async verifyKey(req: Request, res: Response) {
        const { code, userId } = req.body;
        if (!userId) {
            await this.logAction(req, "verifyKey", 400);
            return res.status(400).send({ message: "User ID is required" });
        }
        try {
            const user = await this.userService.getUser(userId);
            if (!user) {
                await this.logAction(req, "verifyKey", 404);
                return res.status(404).send({ message: "User not found" });
            }
            const key = user.authenticator_secret;
            if (!key || !code) {
                await this.logAction(req, "verifyKey", 400);
                return res.status(400).send({ message: "Key and code are required" });
            }
            const isValid = Totp.validate({ secret: key, passcode: code });
            if (isValid) {
                await this.logAction(req, "verifyKey", 200);
                // Génère la clé API puis le JWT
                const apiKey = genKey(user.user_id);
                const jwtToken = generateUserJwt(user, apiKey);
                return res.status(200).send({ message: "Key verified successfully", token: jwtToken });
            } else {
                await this.logAction(req, "verifyKey", 400);
                return res.status(400).send({ message: "Invalid key or code" });
            }
        } catch (error) {
            await this.logAction(req, "verifyKey", 500, { error });
            handleError(res, error, "Error verifying key");
        }
    }

    @httpPost("/delete", LoggedCheck.middleware)
    async deleteKey(req: AuthenticatedRequest, res: Response) {
        const user = req.user;
        if (!user || !user.email) {
            await this.logAction(req, "deleteKey", 400);
            return res.status(400).send({ message: "User not authenticated or email missing" });
        }
        try {
            await this.userService.setAuthenticatorSecret(user.user_id, null);
            await this.logAction(req, "deleteKey", 200);
            res.status(200).send({ message: "Google Authenticator deleted successfully" });
        } catch (error) {
            await this.logAction(req, "deleteKey", 500, { error });
            handleError(res, error, "Error deleting authenticator");
        }
    }
}
