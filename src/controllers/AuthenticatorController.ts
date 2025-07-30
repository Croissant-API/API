/* eslint-disable @typescript-eslint/no-explicit-any */
import { controller, httpPost } from "inversify-express-utils";
import { inject } from "inversify";
import { Request, Response } from "express";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import * as qrcode from "qrcode";


import { Totp } from "time2fa";
import { genKey } from "../utils/GenKey";
import { IUserService } from "../services/UserService";

@controller("/authenticator")
export class Authenticator {
    constructor(@inject("UserService") private userService: IUserService) { }

    
    @httpPost("/generateKey", LoggedCheck.middleware)
    async generateKey(req: AuthenticatedRequest, res: Response) {
        const user = req.user;
        if (!user || !user.email) {
            return res.status(400).send({ message: "User not authenticated or email missing" });
        }
        const key = Totp.generateKey({ issuer: "Croissant API", user: user.email });
        qrcode.toDataURL(key.url, (err: any, url: any) => {
            if (err) {
                console.error("Error generating QR code:", err);
                return res.status(500).send({ message: "Error generating QR code" });
            }
            res.status(200).send({ key, qrCode: url });
        });
    }

    
    @httpPost("/registerKey", LoggedCheck.middleware)
    async registerKey(req: AuthenticatedRequest, res: Response) {
        const user = req.user;
        const { key, passcode } = req.body;
        if (!user || !user.email || !key) {
            return res.status(400).send({ message: "User not authenticated, email missing, or key missing" });
        }
        if (!passcode) {
            return res.status(400).send({ message: "Passcode is required" });
        }
        const isValid = Totp.validate({ secret: key.secret, passcode });
        if (!isValid) {
            return res.status(400).send({ message: "Invalid passcode" });
        }
        await this.userService.setAuthenticatorSecret(user.user_id, key.secret);
        res.status(200).send({ message: "Key registered successfully" });
    }

    
    @httpPost("/verifyKey")
    async verifyKey(req: Request, res: Response) {
        const { code, userId } = req.body;
        if (!userId) {
            return res.status(400).send({ message: "User ID is required" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        const key = user.authenticator_secret;
        if (!key || !code) {
            return res.status(400).send({ message: "Key and code are required" });
        }
        const isValid = Totp.validate({ secret: key, passcode: code });
        if (isValid) {
            return res.status(200).send({ message: "Key verified successfully", token: genKey(user.user_id) });
        } else {
            return res.status(400).send({ message: "Invalid key or code" });
        }
    }

    
    @httpPost("/delete", LoggedCheck.middleware)
    async deleteKey(req: AuthenticatedRequest, res: Response) {
        const user = req.user;
        if (!user || !user.email) {
            return res.status(400).send({ message: "User not authenticated or email missing" });
        }
        await this.userService.setAuthenticatorSecret(user.user_id, null);
        res.status(200).send({ message: "Google Authenticator deleted successfully" });
    }

}
