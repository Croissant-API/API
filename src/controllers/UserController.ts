import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { inject } from 'inversify';
import crypto from 'crypto';
import { controller, httpGet, httpPost } from "inversify-express-utils";
import { IUserService } from '../services/UserService';
import { userIdParamValidator } from '../validators/UserValidator';
import { describe } from '../decorators/describe';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { genKey, genVerificationKey } from '../utils/GenKey';

import { User } from '../interfaces/User';
import { SteamOAuthService } from '../services/SteamOAuthService';
import { MailService } from '../services/MailService';
import { StudioService } from '../services/StudioService';
import { Studio } from '../interfaces/Studio';


@controller("/users")
export class Users {
    constructor(
        @inject("UserService") private userService: IUserService,
        @inject("SteamOAuthService") private steamOAuthService: SteamOAuthService,
        @inject("MailService") private mailService: MailService,
        @inject("StudioService") private studioService: StudioService
    ) { }

    @httpPost("/login-oauth")
    public async loginOAuth(req: Request, res: Response) {
        const { email, provider, providerId, username } = req.body;
        if (!email || !provider || !providerId) {
            return res.status(400).send({ message: "Missing email, provider or providerId" });
        }
        // Vérifie si l'utilisateur existe par email
        let user = await this.userService.findByEmail(email);
        if (!user) {
            // Création d'un nouvel utilisateur si non existant
            const userId = crypto.randomUUID();
            user = await this.userService.createUser(userId, username || "", email, null, provider, providerId);
            await this.mailService.sendAccountConfirmationMail(user.email);
        } else {
            // Si l'association n'existe pas, on l'ajoute
            if ((provider === "discord" && !user.discord_id) || (provider === "google" && !user.google_id)) {
                await this.userService.associateOAuth(user.user_id, provider, providerId);
            }
            // Vérifie que l'id provider correspond bien
            if ((provider === "discord" && user.discord_id && user.discord_id !== providerId) ||
                (provider === "google" && user.google_id && user.google_id !== providerId)) {
                return res.status(401).send({ message: "OAuth providerId mismatch" });
            }
        }
        if (user.disabled) {
            return res.status(403).send({ message: "Account is disabled" });
        }
        res.status(200).send({ message: "Login successful", user: { userId: user.user_id, username: user.username, email: user.email }, token: genKey(user.user_id) });
    }

    @httpPost("/change-username", LoggedCheck.middleware)
    public async changeUsername(req: AuthenticatedRequest, res: Response) {
        const userId = req.user?.user_id;
        const { username } = req.body;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        if (!username || typeof username !== "string" || username.trim().length < 3) {
            return res.status(400).send({ message: "Invalid username (min 3 characters)" });
        }
        try {
            await this.userService.updateUser(userId, username.trim());
            res.status(200).send({ message: "Username updated" });
        } catch (error) {
            console.error("Error updating username", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error updating username", error: message });
        }
    }

    @httpGet("/steam-redirect")
    public async steamRedirect(req: Request, res: Response) {
        const url = this.steamOAuthService.getAuthUrl();
        res.send(url);
    }

    @httpGet("/steam-associate", LoggedCheck.middleware)
    public async steamAssociate(req: AuthenticatedRequest, res: Response) {
        const user = req.user;
        if (!user) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            // Vérifie la réponse OpenID de Steam
            const steamId = await this.steamOAuthService.verifySteamOpenId(req.query as Record<string, string | string[]>);
            if (!steamId) {
                return res.status(400).send({ message: "Steam authentication failed" });
            }
            // Récupère le profil Steam
            const profile = await this.steamOAuthService.getSteamProfile(steamId);
            if (!profile) {
                return res.status(400).send({ message: "Unable to fetch Steam profile" });
            }
            // Met à jour l'utilisateur avec les infos Steam
            await this.userService.updateSteamFields(user.user_id, profile.steamid, profile.personaname, profile.avatarfull);
            // Redirige vers /settings (front-end route)
            res.send(`<html><head><meta http-equiv="refresh" content="0;url=/settings"></head><body>Redirecting to <a href="/settings">/settings</a>...</body></html>`);
        } catch (error) {
            console.error("Error associating Steam account", error);
            // const message = (error instanceof Error) ? error.message : String(error);
            // res.status(500).send({ message: "Error associating Steam account", error: message });
        }
    }

    @httpPost("/unlink-steam", LoggedCheck.middleware)
    public async unlinkSteam(req: AuthenticatedRequest, res: Response) {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            await this.userService.updateSteamFields(userId, null, null, null);
            res.status(200).send({ message: "Steam account unlinked" });
        } catch (error) {
            console.error("Error unlinking Steam account", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error unlinking Steam account", error: message });
        }
    }

    @httpGet("/admin/search")
    public async adminSearchUsers(req: Request, res: Response) {
        const query = (req.query.q as string)?.trim();
        if (!query) {
            return res.status(400).send({ message: "Missing search query" });
        }
        try {
            const users: User[] = await this.userService.adminSearchUsers(query);

            const filtered = [];
            for (const user of users) {
                // const discordUser = await this.userService.getDiscordUser(user.user_id);
                filtered.push({
                    // ...discordUser,
                    id: user.user_id,
                    userId: user.user_id,
                    username: user.username,
                    balance: Math.floor(user.balance),
                    verified: user.verified,
                    steam_id: user.steam_id,
                    steam_username: user.steam_username,
                    steam_avatar_url: user.steam_avatar_url,
                    isStudio: user.isStudio,
                    admin: !!user.admin
                });
            }
            res.send(filtered);
        } catch (error) {
            console.error("Error searching users", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error searching users", error: message });
        }
    }

    @httpPost("/admin/disable/:userId", LoggedCheck.middleware)
    public async disableAccount(req: AuthenticatedRequest, res: Response) {
        const { userId } = req.params;
        const adminUserId = req.user?.user_id;
        if (!adminUserId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            await this.userService.disableAccount(userId, adminUserId);
            res.status(200).send({ message: "Account disabled" });
        } catch (error) {
            res.status(403).send({ message: error instanceof Error ? error.message : String(error) });
        }
    }

    @httpPost("/admin/enable/:userId", LoggedCheck.middleware)
    public async reenableAccount(req: AuthenticatedRequest, res: Response) {
        const { userId } = req.params;
        const adminUserId = req.user?.user_id;
        if (!adminUserId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            await this.userService.reenableAccount(userId, adminUserId);
            res.status(200).send({ message: "Account re-enabled" });
        } catch (error) {
            res.status(403).send({ message: error instanceof Error ? error.message : String(error) });
        }
    }

    @httpGet("/admin/:userId")
    public async adminGetUser(req: Request, res: Response) {
        try {
            await userIdParamValidator.validate(req.params);
        } catch (err) {
            return res.status(400).send({ message: "Invalid userId", error: err });
        }
        const { userId } = req.params;
        const user = await this.userService.adminGetUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        // Filter user to only expose allowed fields
        // const discordUser = await this.userService.getDiscordUser(user.user_id);
        const filteredUser: {
            id: string;
            userId: string;
            balance: number;
            verified: boolean;
            username: string;
            admin?: boolean;
            disabled?: boolean;
            isStudio?: boolean;
        } = {
            // ...discordUser,
            id: user.user_id,
            userId: user.user_id,
            balance: Math.floor(user.balance),
            verified: user.verified,
            username: user.username,
            disabled: !!user.disabled,
            admin: !!user.admin,
            isStudio: !!user.isStudio
        };
        if (user.admin) {
            filteredUser.admin = user.admin;
        }
        res.send(filteredUser);
    }

    @httpGet("/validate-reset-token")
    public async isValidResetToken(req: Request, res: Response) {
        const { reset_token } = req.query;
        if (!reset_token) {
            return res.status(400).send({ message: "Missing required fields" });
        }
        const users = await this.userService.getAllUsersWithDisabled();
        const user = users.find(u => u.forgot_password_token === reset_token);
        if (!user) {
            return res.status(404).send({ message: "Invalid reset token" });
        }
        res.status(200).send({ message: "Valid reset token", user });
    }

    @httpPost("/register")
    public async register(req: Request, res: Response) {
        const { username, email, password, provider, providerId } = req.body;
        let { userId } = req.body;
        if (!username || !email || (!password && !provider)) {
            return res.status(400).send({ message: "Missing required fields" });
        }

        const users = await this.userService.getAllUsersWithDisabled();
        if (users.find(u => u.email === email)) {
            return res.status(400).send({ message: "Email already exists" });
        }

        if (!userId) {
            userId = crypto.randomUUID();
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).send({ message: "Invalid email address" });
        }
        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }
        try {
            // Crée ou associe l'utilisateur selon l'email et provider
            const user = await this.userService.createUser(userId, username, email, hashedPassword, provider, providerId);
            await this.mailService.sendAccountConfirmationMail(user.email);
            res.status(201).send({ message: "User registered", token: genKey(user.user_id) });
        } catch (error) {
            console.error("Error registering user", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error registering user", error: message });
        }
    }

    @httpPost("/login")
    public async login(req: Request, res: Response) {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).send({ message: "Missing email or password" });
        }
        const allUsers = await this.userService.getAllUsersWithDisabled();
        const user = allUsers.find(u => u.email === email);
        if (!user || !user.password) {
            return res.status(401).send({ message: "Invalid credentials" });
        }
        // bcrypt importé en haut
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).send({ message: "Invalid credentials" });
        }
        // Check si le compte est désactivé
        if (user.disabled) {
            return res.status(403).send({ message: "Account is disabled" });
        }
        this.mailService.sendConnectionNotificationMail(user.email, user.username).catch(err => {
            console.error("Error sending connection notification email", err);
        });
        res.status(200).send({ message: "Login successful", user: { userId: user.user_id, username: user.username, email: user.email }, token: genKey(user.user_id) });
    }

    @httpPost("/change-password", LoggedCheck.middleware)
    public async changePassword(req: AuthenticatedRequest, res: Response) {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        if (!newPassword || !confirmPassword) {
            return res.status(400).send({ message: "Missing newPassword or confirmPassword" });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).send({ message: "New password and confirm password do not match" });
        }
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        let valid = true;
        if (user.password) {
            valid = await bcrypt.compare(oldPassword, user.password);
        }
        if (!valid) {
            return res.status(401).send({ message: "Invalid current password" });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        try {
            await this.userService.updateUserPassword(userId, hashedPassword);
            res.status(200).send({ message: "Password changed successfully" });
        } catch (error) {
            console.error("Error changing password", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error changing password", error: message });
        }
    }

    @httpPost("/forgot-password")
    public async forgotPassword(req: Request, res: Response) {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send({ message: "Email is required" });
        }
        const user = await this.userService.findByEmail(email);
        if (!user) {
            return res.status(404).send({ message: "Invalid email" });
        }
        // Here you would typically generate a password reset token and send it via email
        const passwordResetToken = await this.userService.generatePasswordResetToken(email)
        await this.mailService.sendPasswordResetMail(email, passwordResetToken);
        res.status(200).send({ message: "Password reset email sent" });
    }

    @httpPost("/reset-password")
    public async resetPassword(req: Request, res: Response) {
        const { new_password, confirm_password, reset_token } = req.body;
        if (!new_password || !reset_token || !confirm_password) {
            return res.status(400).send({ message: "Missing required fields" });
        }
        if (new_password !== confirm_password) {
            return res.status(400).send({ message: "New password and confirm password do not match" });
        }
        const allUsers = await this.userService.getAllUsersWithDisabled();
        const user = allUsers.find(u => u.forgot_password_token === reset_token);
        if (!user) {
            return res.status(404).send({ message: "Invalid user" });
        }
        const hashedPassword = await bcrypt.hash(new_password, 10);
        try {
            await this.userService.updateUserPassword(user.user_id, hashedPassword);
            res.status(200).send({ message: "Password reset successfully", token: genKey(user.user_id) });
        } catch (error) {
            console.error("Error resetting password", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error resetting password", error: message });
        }
    }

    @httpPost("/change-role", LoggedCheck.middleware)
    async changeRole(req: AuthenticatedRequest, res: Response) {
        const userId = req.originalUser?.user_id;
        const { role } = req.body;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        if (!role || typeof role !== "string") {
            return res.status(400).send({ message: "Invalid role" });
        }
        try {
            const {success, error} = await this.studioService.changeRole(userId, role);
            const user = await this.userService.getUser(role);
            if(!user) {
                return res.status(404).send({ message: "User not found" });
            }
            const studios = await this.studioService.getUserStudios(userId);
            const roles = [userId, ...studios.map(s => s.user_id)];
            const filteredUser: {
                id: string;
                userId: string;
                email: string;
                balance: number;
                verified: boolean;
                username: string;
                verificationKey: string;
                steam_id?: string;
                steam_username?: string;
                steam_avatar_url?: string;
                admin?: boolean;
                studios?: Studio[];
                isStudio?: boolean;
                roles?: string[];
            } = {
                // ...discordUser,
                id: user.user_id,
                userId: user.user_id,
                email: user.email,
                balance: Math.floor(user.balance),
                verified: user.verified,
                username: user.username,
                verificationKey: genVerificationKey(user.user_id),
                steam_id: user.steam_id,
                steam_username: user.steam_username,
                steam_avatar_url: user.steam_avatar_url,
                studios: studios,
                isStudio: user.isStudio,
                roles,
                admin: !!user.admin
            };

            if (success) {
                return res.status(200).send({ message: "Role updated successfully", user: filteredUser });
            } else {
                return res.status(400).send({ message: "Failed to update role", error });
            }
        } catch (error) {
            console.error("Error changing role", error);
            const message = (error instanceof Error) ? error.message : String(error);
            return res.status(500).send({ message: "Error changing role", error: message });
        }
    }
    @describe({
        endpoint: "/users/@me",
        method: "GET",
        description: "Get the authenticated user's information",
        responseType: { userId: "string", balance: "number", username: "string", verified: "boolean", steam_id: "string", steam_username: "string", steam_avatar_url: "string", isStudio: "boolean", admin: "boolean", roles: "string[]", studios: "Studio[]" },
        example: "GET /api/users/@me",
        requiresAuth: true
    })
    @httpGet("/@me", LoggedCheck.middleware)
    async getMe(req: AuthenticatedRequest, res: Response) {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        // Filter user to only expose allowed fields
        // const discordUser = await this.userService.getDiscordUser(user.user_id)
        const studios = await this.studioService.getUserStudios(req.originalUser?.user_id || user.user_id);
        const roles = [req.originalUser?.user_id as string, ...studios.map(s => s.user_id)];
        const filteredUser: {
            id: string;
            userId: string;
            email: string;
            balance: number;
            verified: boolean;
            username: string;
            verificationKey: string;
            steam_id?: string;
            steam_username?: string;
            steam_avatar_url?: string;
            admin?: boolean;
            studios?: Studio[];
            isStudio?: boolean;
            roles?: string[];
        } = {
            // ...discordUser,
            id: user.user_id,
            userId: user.user_id,
            email: user.email,
            balance: Math.floor(user.balance),
            verified: user.verified,
            username: user.username,
            verificationKey: genVerificationKey(user.user_id),
            steam_id: user.steam_id,
            steam_username: user.steam_username,
            steam_avatar_url: user.steam_avatar_url,
            studios: studios,
            isStudio: user.isStudio,
            roles,
            admin: !!user.admin
        };
        if (user.admin) {
            filteredUser.admin = user.admin;
        }
        res.send(filteredUser);
    }

    @describe({
        endpoint: "/users/search",
        method: "GET",
        description: "Search for users by username",
        query: { q: "The search query" },
        responseType: [{ userId: "string", balance: "number", username: "string", verified: "boolean", steam_id: "string", steam_username: "string", steam_avatar_url: "string", isStudio: "boolean", admin: "boolean" }],
        example: "GET /api/users/search?q=John",
    })
    @httpGet("/search")
    public async searchUsers(req: Request, res: Response) {
        const query = (req.query.q as string)?.trim();
        if (!query) {
            return res.status(400).send({ message: "Missing search query" });
        }
        try {
            const users: User[] = await this.userService.searchUsersByUsername(query);

            const filtered = [];
            for (const user of users) {
                // const discordUser = await this.userService.getDiscordUser(user.user_id);
                filtered.push({
                    // ...discordUser,
                    id: user.user_id,
                    userId: user.user_id,
                    username: user.username,
                    balance: Math.floor(user.balance),
                    verified: user.verified,
                    steam_id: user.steam_id,
                    steam_username: user.steam_username,
                    steam_avatar_url: user.steam_avatar_url,
                    isStudio: user.isStudio,
                    admin: !!user.admin
                });
            }
            res.send(filtered);
        } catch (error) {
            console.error("Error searching users", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error searching users", error: message });
        }
    }

    @describe({
        endpoint: "/users/auth-verification",
        method: "POST",
        description: "Check the verification key for the user",
        responseType: { success: "boolean" },
        query: { userId: "The id of the user", verificationKey: "The verification key" },
        example: "POST /api/users/auth-verification?userId=123&verificationKey=abc123"
    })
    @httpPost("/auth-verification")
    async checkVerificationKey(req: Request, res: Response) {
        const { userId, verificationKey } = req.body;
        if (!userId || !verificationKey) {
            return res.status(400).send({ message: "Missing userId or verificationKey" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        const expectedKey = genVerificationKey(user.user_id);
        res.send({ success: verificationKey === expectedKey });
    }

    @describe({
        endpoint: "/users/getUserBySteamId",
        method: "GET",
        description: "Get a user by their Steam ID",
        query: { steamId: "The Steam ID of the user" },
        responseType: { id: "string", username: "string" },
        example: "GET /api/users/getUserBySteamId?steamId=1234567890"
    })
    @httpGet("/getUserBySteamId")
    public async getUserBySteamId(req: Request, res: Response) {
        const steamId = req.query.steamId as string;
        if (!steamId) {
            return res.status(400).send({ message: "Missing steamId query parameter" });
        }
        try {
            const user = await this.userService.getUserBySteamId(steamId);
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }
            // const discordUser = await this.userService.getDiscordUser(user.user_id);
            if (!user.steam_id) {
                return res.status(404).send({ message: "User does not have a linked Steam account" });
            }
            const filteredUser = {
                // ...discordUser,
                id: user.user_id,
                username: user.username
            };
            res.send(filteredUser);
        } catch (error) {
            console.error("Error fetching user by Steam ID", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user by Steam ID", error: message });
        }
    }

    @describe({
        endpoint: "/users/transfer-credits",
        method: "POST",
        description: "Transfer credits from one user to another",
        body: { targetUserId: "The id of the recipient", amount: "The amount to transfer" },
        responseType: { message: "string" },
        example: "POST /api/users/transfer-credits { targetUserId: '456', amount: 50 }",
        requiresAuth: true
    })
    @httpPost("/transfer-credits", LoggedCheck.middleware)
    public async transferCredits(req: AuthenticatedRequest, res: Response) {
        const { targetUserId, amount } = req.body;
        if (!targetUserId || isNaN(amount) || amount <= 0) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const sender = req.user;
            if (!sender) {
                return res.status(401).send({ message: "Unauthorized" });
            }
            if (sender.user_id === targetUserId) {
                return res.status(400).send({ message: "Cannot transfer credits to yourself" });
            }
            const recipient = await this.userService.getUser(targetUserId);
            if (!recipient) {
                return res.status(404).send({ message: "Recipient not found" });
            }
            if (sender.balance < amount) {
                return res.status(400).send({ message: "Insufficient balance" });
            }

            await this.userService.updateUserBalance(sender.user_id, sender.balance - Number(amount));
            await this.userService.updateUserBalance(recipient.user_id, recipient.balance + Number(amount));

            res.status(200).send({ message: "Credits transferred" });
        } catch (error) {
            console.error("Error transferring credits", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error transferring credits", error: message });
        }
    }

    @describe({
        endpoint: "/users/:userId",
        method: "GET",
        description: "Get a user by userId",
        params: { userId: "The id of the user" },
        responseType: { userId: "string", balance: "number", username: "string", verified: "boolean", steam_id: "string", steam_username: "string", steam_avatar_url: "string", isStudio: "boolean", admin: "boolean" },
        example: "GET /api/users/123"
    })
    @httpGet("/:userId")
    public async getUser(req: Request, res: Response) {
        try {
            await userIdParamValidator.validate(req.params);
        } catch (err) {
            return res.status(400).send({ message: "Invalid userId", error: err });
        }
        const { userId } = req.params;
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }

        const filteredUser = {
            // ...discordUser,
            id: user.user_id,
            userId: user.user_id,
            balance: Math.floor(user.balance),
            username: user.username,
            steam_id: user.steam_id,
            steam_username: user.steam_username,
            steam_avatar_url: user.steam_avatar_url,
            verified: !!user.verified,
            isStudio: !!user.isStudio,
            admin: !!user.admin
        };
        res.send(filteredUser);
    }
}