/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { inject } from "inversify";
import crypto from "crypto";
import { controller, httpGet, httpPost } from "inversify-express-utils";
import { IUserService } from "../services/UserService";
import { ILogService } from "../services/LogService";
import { userIdParamValidator } from "../validators/UserValidator";
import { describe } from "../decorators/describe";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { genKey, genVerificationKey } from "../utils/GenKey";
import { User } from "../interfaces/User";
import { MailService } from "../services/MailService";
import { StudioService } from "../services/StudioService";

@controller("/users")
export class Users {
  constructor(
    @inject("UserService") private userService: IUserService,
    @inject("LogService") private logService: ILogService,
    @inject("MailService") private mailService: MailService,
    @inject("StudioService") private studioService: StudioService,
    @inject("SteamOAuthService") private steamOAuthService: any // Assuming you have a SteamOAuthService
  ) { }

  // Helper simplifié - garde seulement les essentiels
  private sendError(res: Response, status: number, message: string) {
    return res.status(status).send({ message });
  }

  // Helper pour créer des logs
  private async createLog(req: Request, controller: string, tableName?: string, statusCode?: number, userId?: string) {
    try {
      await this.logService.createLog({
        ip_address: req.headers["x-forwarded-for"] as string || req.socket.remoteAddress as string,
        table_name: tableName,
        controller: `UserController.${controller}`,
        original_path: req.originalUrl,
        http_method: req.method,
        request_body: req.body,
        user_id: userId,
        status_code: statusCode
      });
    } catch (error) {
      console.error('Error creating log:', error);
    }
  }

  // Ce helper peut être inline dans les méthodes
  private requireFields(obj: any, fields: string[]): boolean {
    return fields.every(f => obj[f]);
  }

  private mapUser(user: User) {
    return {
      id: user.user_id,
      userId: user.user_id,
      username: user.username,
      email: user.email,
      balance: user.balance !== undefined ? Math.floor(user.balance) : undefined,
      verified: !!user.verified,
      steam_id: user.steam_id,
      steam_username: user.steam_username,
      steam_avatar_url: user.steam_avatar_url,
      isStudio: !!user.isStudio,
      admin: !!user.admin,
      disabled: !!user.disabled,
    };
  }

  private mapUserSearch(user: User) {
    return {
      id: user.user_id,
      userId: user.user_id,
      username: user.username,
      verified: user.verified,
      steam_id: user.steam_id,
      steam_username: user.steam_username,
      steam_avatar_url: user.steam_avatar_url,
      isStudio: user.isStudio,
      admin: !!user.admin,
    };
  }

  // --- AUTHENTIFICATION & INSCRIPTION ---
  
  @httpPost("/login-oauth")
  public async loginOAuth(req: Request, res: Response) {
    const { email, provider, providerId, username } = req.body;
    if (!email || !provider || !providerId) {
      await this.createLog(req, 'loginOAuth', 'users', 400);
      return res
        .status(400)
        .send({ message: "Missing email, provider or providerId" });
    }

    const users = await this.userService.getAllUsersWithDisabled();
    const authHeader =
      req.headers["authorization"] ||
      "Bearer " +
      req.headers["cookie"]?.toString().split("token=")[1]?.split(";")[0];
    const token = authHeader.split("Bearer ")[1];

    let user = await this.userService.authenticateUser(token);
    if (!user) {
      user = users.find((u) => u.discord_id === providerId || u.google_id === providerId) || null;
    }

    if (!user) {
      const userId = crypto.randomUUID();
      user = await this.userService.createUser(
        userId,
        username || "",
        email,
        null,
        provider,
        providerId
      );
      await this.mailService.sendAccountConfirmationMail(user.email);
      await this.createLog(req, 'loginOAuth', 'users', 201, userId);
    } else {
      if (
        (provider === "discord" && !user.discord_id) ||
        (provider === "google" && !user.google_id)
      ) {
        await this.userService.associateOAuth(
          user.user_id,
          provider,
          providerId
        );
      }
      if (
        (provider === "discord" &&
          user.discord_id &&
          user.discord_id !== providerId) ||
        (provider === "google" &&
          user.google_id &&
          user.google_id !== providerId)
      ) {
        await this.createLog(req, 'loginOAuth', 'users', 401, user.user_id);
        return res.status(401).send({ message: "OAuth providerId mismatch" });
      }
    }
    if (user.disabled) {
      await this.createLog(req, 'loginOAuth', 'users', 403, user.user_id);
      return res.status(403).send({ message: "Account is disabled" });
    }
    
    await this.createLog(req, 'loginOAuth', 'users', 200, user.user_id);
    res.status(200).send({
      message: "Login successful",
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
      },
      token: genKey(user.user_id),
    });
  }

  
  @httpPost("/register")
  public async register(req: Request, res: Response) {
    const missing = this.requireFields(req.body, ["username", "email"]);
    if (missing || (!req.body.password && !req.body.provider)) {
      await this.createLog(req, 'register', 'users', 400);
      return this.sendError(res, 400, "Missing required fields");
    }

    const users = await this.userService.getAllUsersWithDisabled();
    if (users.find((u) => u.email === req.body.email)) {
      await this.createLog(req, 'register', 'users', 400);
      return this.sendError(res, 400, "Email already exists");
    }

    let userId = req.body.userId;
    if (!userId) {
      userId = crypto.randomUUID();
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
      await this.createLog(req, 'register', 'users', 400);
      return this.sendError(res, 400, "Invalid email address");
    }
    let hashedPassword = null;
    if (req.body.password) {
      hashedPassword = await bcrypt.hash(req.body.password, 10);
    }
    try {
      const user = await this.userService.createUser(
        userId,
        req.body.username,
        req.body.email,
        hashedPassword,
        req.body.provider,
        req.body.providerId
      );
      await this.mailService.sendAccountConfirmationMail(user.email);
      await this.createLog(req, 'register', 'users', 201, userId);
      res
        .status(201)
        .send({ message: "User registered", token: genKey(user.user_id) });
    } catch (error) {
      console.error("Error registering user", error);
      await this.createLog(req, 'register', 'users', 500);
      this.sendError(res, 500, "Error registering user");
    }
  }

  
  @httpPost("/login")
  public async login(req: Request, res: Response) {
    const allUsers = await this.userService.getAllUsersWithDisabled();
    const user = allUsers.find((u) => u.email === req.body.email);
    if (!user || !user.password) {
      await this.createLog(req, 'login', 'users', 401);
      return this.sendError(res, 401, "Invalid credentials");
    }
    const valid = await bcrypt.compare(req.body.password, user.password);
    if (!valid) {
      await this.createLog(req, 'login', 'users', 401, user.user_id);
      return this.sendError(res, 401, "Invalid credentials");
    }
    if (user.disabled) {
      await this.createLog(req, 'login', 'users', 403, user.user_id);
      return this.sendError(res, 403, "Account is disabled");
    }
    this.mailService
      .sendConnectionNotificationMail(user.email, user.username)
      .catch((err) => {
        console.error("Error sending connection notification email", err);
      });
    
    await this.createLog(req, 'login', 'users', 200, user.user_id);
    if (!user.authenticator_secret) {
      res.status(200).send({
        message: "Login successful",
        token: genKey(user.user_id),
      });
    } else {
      res.status(200).send({
        message: "Login successful",
        user: {
          userId: user.user_id,
          username: user.username,
          email: user.email,
        },
      });
    }
  }

  
  @describe({
    endpoint: "/users/@me",
    method: "GET",
    description: "Get the current authenticated user's profile, including studios, roles, inventory, owned items, and created games.",
    responseType: {
      userId: "string",
      username: "string",
      email: "string",
      verified: "boolean",
      studios: "array",
      roles: "array",
      inventory: "array",
      ownedItems: "array",
      createdGames: "array",
      verificationKey: "string"
    },
    example: "GET /api/users/@me"
  })
  @httpGet("/@me", LoggedCheck.middleware)
  async getMe(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.user_id;
    if (!userId) {
      await this.createLog(req, 'getMe', 'users', 401);
      return this.sendError(res, 401, "Unauthorized");
    }
    
    // Get user with all related data in one call
    const userWithData = await this.userService.getUserWithCompleteProfile(userId);
    if (!userWithData) {
      await this.createLog(req, 'getMe', 'users', 404, userId);
      return this.sendError(res, 404, "User not found");
    }
    
    const studios = await this.studioService.getUserStudios(req.originalUser?.user_id || userId);
    const roles = [req.originalUser?.user_id as string, ...studios.map((s) => s.user_id)];

    await this.createLog(req, 'getMe', 'users', 200, userId);
    res.send({ 
      ...this.mapUser(userWithData), 
      verificationKey: genVerificationKey(userWithData.user_id), 
      google_id: userWithData.google_id, 
      discord_id: userWithData.discord_id, 
      studios, 
      roles, 
      inventory: userWithData.inventory || [], 
      ownedItems: userWithData.ownedItems || [], 
      createdGames: userWithData.createdGames || [], 
      haveAuthenticator: !!userWithData.authenticator_secret 
    });
  }

  
  @httpPost("/change-username", LoggedCheck.middleware)
  public async changeUsername(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.user_id;
    const { username } = req.body;
    if (!userId) {
      await this.createLog(req, 'changeUsername', 'users', 401);
      return this.sendError(res, 401, "Unauthorized");
    }
    if (!username || typeof username !== "string" || username.trim().length < 3) {
      await this.createLog(req, 'changeUsername', 'users', 400, userId);
      return this.sendError(res, 400, "Invalid username (min 3 characters)");
    }
    try {
      await this.userService.updateUser(userId, username.trim());
      await this.createLog(req, 'changeUsername', 'users', 200, userId);
      res.status(200).send({ message: "Username updated" });
    } catch (error) {
      await this.createLog(req, 'changeUsername', 'users', 500, userId);
      this.sendError(res, 500, "Error updating username");
    }
  }

  
  @httpPost("/change-password", LoggedCheck.middleware)
  public async changePassword(req: AuthenticatedRequest, res: Response) {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (!newPassword || !confirmPassword) {
      await this.createLog(req, 'changePassword', 'users', 400, req.user?.user_id);
      return this.sendError(res, 400, "Missing newPassword or confirmPassword");
    }
    if (newPassword !== confirmPassword) {
      await this.createLog(req, 'changePassword', 'users', 400, req.user?.user_id);
      return this.sendError(res, 400, "New password and confirm password do not match");
    }
    const userId = req.user?.user_id;
    if (!userId) {
      await this.createLog(req, 'changePassword', 'users', 401);
      return this.sendError(res, 401, "Unauthorized");
    }
    const user = await this.userService.getUser(userId);
    if (!user) {
      await this.createLog(req, 'changePassword', 'users', 404, userId);
      return this.sendError(res, 404, "User not found");
    }
    let valid = true;
    if (user.password) valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      await this.createLog(req, 'changePassword', 'users', 401, userId);
      return this.sendError(res, 401, "Invalid current password");
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    try {
      await this.userService.updateUserPassword(userId, hashedPassword);
      await this.createLog(req, 'changePassword', 'users', 200, userId);
      res.status(200).send({ message: "Password changed successfully" });
    } catch (error) {
      await this.createLog(req, 'changePassword', 'users', 500, userId);
      this.sendError(res, 500, "Error changing password");
    }
  }

  
  @httpPost("/forgot-password")
  public async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    if (!email) {
      await this.createLog(req, 'forgotPassword', 'users', 400);
      return this.sendError(res, 400, "Email is required");
    }
    const user = await this.userService.findByEmail(email);
    if (!user) {
      await this.createLog(req, 'forgotPassword', 'users', 404);
      return this.sendError(res, 404, "Invalid email");
    }
    const passwordResetToken = await this.userService.generatePasswordResetToken(email);
    await this.mailService.sendPasswordResetMail(email, passwordResetToken);
    await this.createLog(req, 'forgotPassword', 'users', 200, user.user_id);
    res.status(200).send({ message: "Password reset email sent" });
  }

  
  @httpPost("/reset-password")
  public async resetPassword(req: Request, res: Response) {
    const { new_password, confirm_password, reset_token } = req.body;
    if (!new_password || !reset_token || !confirm_password) {
      await this.createLog(req, 'resetPassword', 'users', 400);
      return this.sendError(res, 400, "Missing required fields");
    }
    if (new_password !== confirm_password) {
      await this.createLog(req, 'resetPassword', 'users', 400);
      return this.sendError(res, 400, "New password and confirm password do not match");
    }
    const user = await this.userService.findByResetToken(reset_token);
    if (!user) {
      await this.createLog(req, 'resetPassword', 'users', 404);
      return this.sendError(res, 404, "Invalid user");
    }
    const hashedPassword = await bcrypt.hash(new_password, 10);
    try {
      await this.userService.updateUserPassword(user.user_id, hashedPassword);
      await this.createLog(req, 'resetPassword', 'users', 200, user.user_id);
      res.status(200).send({ message: "Password reset successfully", token: genKey(user.user_id) });
    } catch (error) {
      await this.createLog(req, 'resetPassword', 'users', 500, user.user_id);
      this.sendError(res, 500, "Error resetting password");
    }
  }

  
  @httpGet("/steam-redirect")
  public async steamRedirect(req: Request, res: Response) {
    const url = this.steamOAuthService.getAuthUrl();
    await this.createLog(req, 'steamRedirect', 'users', 200);
    res.send(url);
  }

  
  @httpGet("/steam-associate", LoggedCheck.middleware)
  public async steamAssociate(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    if (!user) {
      await this.createLog(req, 'steamAssociate', 'users', 401);
      return res.status(401).send({ message: "Unauthorized" });
    }
    try {
      const steamId = await this.steamOAuthService.verifySteamOpenId(
        req.query as Record<string, string | string[]>
      );
      if (!steamId) {
        await this.createLog(req, 'steamAssociate', 'users', 400, user.user_id);
        return res.status(400).send({ message: "Steam authentication failed" });
      }
      const profile = await this.steamOAuthService.getSteamProfile(steamId);
      if (!profile) {
        await this.createLog(req, 'steamAssociate', 'users', 400, user.user_id);
        return res
          .status(400)
          .send({ message: "Unable to fetch Steam profile" });
      }
      await this.userService.updateSteamFields(
        user.user_id,
        profile.steamid,
        profile.personaname,
        profile.avatarfull
      );
      await this.createLog(req, 'steamAssociate', 'users', 200, user.user_id);
      res.send(
        `<html><head><meta http-equiv="refresh" content="0;url=/settings"></head><body>Redirecting to <a href="/settings">/settings</a>...</body></html>`
      );
    } catch (error) {
      console.error("Error associating Steam account", error);
      await this.createLog(req, 'steamAssociate', 'users', 500, user?.user_id);
    }
  }

  
  @httpPost("/unlink-steam", LoggedCheck.middleware)
  public async unlinkSteam(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.user_id;
    if (!userId) {
      await this.createLog(req, 'unlinkSteam', 'users', 401);
      return res.status(401).send({ message: "Unauthorized" });
    }
    try {
      await this.userService.updateSteamFields(userId, null, null, null);
      await this.createLog(req, 'unlinkSteam', 'users', 200, userId);
      res.status(200).send({ message: "Steam account unlinked" });
    } catch (error) {
      console.error("Error unlinking Steam account", error);
      const message = error instanceof Error ? error.message : String(error);
      await this.createLog(req, 'unlinkSteam', 'users', 500, userId);
      this.sendError(res, 500, "Error unlinking Steam account");
    }
  }

  
  @describe({
    endpoint: "/users/search",
    method: "GET",
    description: "Search for users by username",
    query: { q: "The search query" },
    responseType: [
      {
        userId: "string",
        username: "string",
        verified: "boolean",
        steam_id: "string",
        steam_username: "string",
        steam_avatar_url: "string",
        isStudio: "boolean",
        admin: "boolean",
        inventory: "array",
        ownedItems: "array",
        createdGames: "array"
      },
    ],
    example: "GET /api/users/search?q=John",
  })
  @httpGet("/search")
  public async searchUsers(req: Request, res: Response) {
    const query = (req.query.q as string)?.trim();
    if (!query) {
      await this.createLog(req, 'searchUsers', 'users', 400);
      return this.sendError(res, 400, "Missing search query");
    }
    try {
      const users: User[] = await this.userService.searchUsersByUsername(query);
      await this.createLog(req, 'searchUsers', 'users', 200);
      res.send(users.map(user => this.mapUserSearch(user)));
    } catch (error) {
      await this.createLog(req, 'searchUsers', 'users', 500);
      this.sendError(res, 500, "Error searching users");
    }
  }

  
  @describe({
    endpoint: "/users/:userId",
    method: "GET",
    description:
      "Get a user by userId, userId can be a Croissant ID, Discord ID, Google ID or Steam ID",
    params: { userId: "The id of the user" },
    responseType: {
      userId: "string",
      username: "string",
      verified: "boolean",
      steam_id: "string",
      steam_username: "string",
      steam_avatar_url: "string",
      isStudio: "boolean",
      admin: "boolean",
      inventory: "array",
      ownedItems: "array",
      createdGames: "array"
    },
    example: "GET /api/users/123",
  })
  @httpGet("/:userId")
  public async getUser(req: Request, res: Response) {
    try {
      await userIdParamValidator.validate(req.params);
    } catch (err) {
      await this.createLog(req, 'getUser', 'users', 400);
      return this.sendError(res, 400, "Invalid userId");
    }
    const { userId } = req.params;
    
    // Get user with all related data in one call
    const userWithData = await this.userService.getUserWithPublicProfile(userId);
    if (!userWithData) {
      await this.createLog(req, 'getUser', 'users', 404);
      return this.sendError(res, 404, "User not found");
    }

    await this.createLog(req, 'getUser', 'users', 200);
    res.send({ 
      ...this.mapUserSearch(userWithData), 
      inventory: userWithData.inventory || [], 
      ownedItems: userWithData.ownedItems || [], 
      createdGames: userWithData.createdGames || [] 
    });
  }

  
  @httpGet("/admin/search", LoggedCheck.middleware)
  public async adminSearchUsers(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      await this.createLog(req, 'adminSearchUsers', 'users', 403, req.user?.user_id);
      return res.status(403).send({ message: "Forbidden" });
    }
    const query = (req.query.q as string)?.trim();
    if (!query) {
      await this.createLog(req, 'adminSearchUsers', 'users', 400, req.user.user_id);
      return this.sendError(res, 400, "Missing search query");
    }
    try {
      const users: User[] = await this.userService.adminSearchUsers(query);
      await this.createLog(req, 'adminSearchUsers', 'users', 200, req.user.user_id);
      res.send(users.map(user => this.mapUserSearch(user)));
    } catch (error) {
      await this.createLog(req, 'adminSearchUsers', 'users', 500, req.user.user_id);
      this.sendError(res, 500, "Error searching users");
    }
  }

  
  @httpPost("/admin/disable/:userId", LoggedCheck.middleware)
  public async disableAccount(req: AuthenticatedRequest, res: Response) {
    const { userId } = req.params;
    const adminUserId = req.user?.user_id;
    if (!adminUserId) {
      await this.createLog(req, 'disableAccount', 'users', 401);
      return res.status(401).send({ message: "Unauthorized" });
    }
    try {
      await this.userService.disableAccount(userId, adminUserId);
      await this.createLog(req, 'disableAccount', 'users', 200, adminUserId);
      res.status(200).send({ message: "Account disabled" });
    } catch (error) {
      await this.createLog(req, 'disableAccount', 'users', 403, adminUserId);
      res.status(403).send({
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @httpPost("/admin/enable/:userId", LoggedCheck.middleware)
  public async reenableAccount(req: AuthenticatedRequest, res: Response) {
    const { userId } = req.params;
    const adminUserId = req.user?.user_id;
    if (!adminUserId) {
      await this.createLog(req, 'reenableAccount', 'users', 401);
      return res.status(401).send({ message: "Unauthorized" });
    }
    try {
      await this.userService.reenableAccount(userId, adminUserId);
      await this.createLog(req, 'reenableAccount', 'users', 200, adminUserId);
      res.status(200).send({ message: "Account re-enabled" });
    } catch (error) {
      await this.createLog(req, 'reenableAccount', 'users', 403, adminUserId);
      res.status(403).send({
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @httpGet("/admin/:userId", LoggedCheck.middleware)
  public async adminGetUser(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      await this.createLog(req, 'adminGetUser', 'users', 403, req.user?.user_id);
      return res.status(403).send({ message: "Forbidden" });
    }
    try {
      await userIdParamValidator.validate(req.params);
    } catch (err) {
      await this.createLog(req, 'adminGetUser', 'users', 400, req.user?.user_id);
      return this.sendError(res, 400, "Invalid userId");
    }
    const { userId } = req.params;
    
    // Get user with all related data in one call (admin version includes disabled users)
    const userWithData = await this.userService.adminGetUserWithProfile(userId);
    if (!userWithData) {
      await this.createLog(req, 'adminGetUser', 'users', 404, req.user?.user_id);
      return this.sendError(res, 404, "User not found");
    }

    await this.createLog(req, 'adminGetUser', 'users', 200, req.user?.user_id);
    res.send({ 
      ...this.mapUserSearch(userWithData), 
      disabled: userWithData.disabled, 
      inventory: userWithData.inventory || [], 
      ownedItems: userWithData.ownedItems || [], 
      createdGames: userWithData.createdGames || [] 
    });
  }

  
  @describe({
    endpoint: "/users/transfer-credits",
    method: "POST",
    description: "Transfer credits from one user to another",
    body: {
      targetUserId: "The id of the recipient",
      amount: "The amount to transfer",
    },
    responseType: { message: "string" },
    example:
      "POST /api/users/transfer-credits { targetUserId: '456', amount: 50 }",
    requiresAuth: true,
  })
  @httpPost("/transfer-credits", LoggedCheck.middleware)
  public async transferCredits(req: AuthenticatedRequest, res: Response) {
    const { targetUserId, amount } = req.body;
    if (!targetUserId || isNaN(amount) || amount <= 0) {
      await this.createLog(req, 'transferCredits', 'users', 400, req.user?.user_id);
      return this.sendError(res, 400, "Invalid input");
    }
    try {
      const sender = req.user;
      if (!sender) {
        await this.createLog(req, 'transferCredits', 'users', 401);
        return this.sendError(res, 401, "Unauthorized");
      }
      if (sender.user_id === targetUserId) {
        await this.createLog(req, 'transferCredits', 'users', 400, sender.user_id);
        return this.sendError(res, 400, "Cannot transfer credits to yourself");
      }
      const recipient = await this.userService.getUser(targetUserId);
      if (!recipient) {
        await this.createLog(req, 'transferCredits', 'users', 404, sender.user_id);
        return this.sendError(res, 404, "Recipient not found");
      }
      if (sender.balance < amount) {
        await this.createLog(req, 'transferCredits', 'users', 400, sender.user_id);
        return this.sendError(res, 400, "Insufficient balance");
      }
      await this.userService.updateUserBalance(sender.user_id, sender.balance - Number(amount));
      await this.userService.updateUserBalance(recipient.user_id, recipient.balance + Number(amount));
      await this.createLog(req, 'transferCredits', 'users', 200, sender.user_id);
      res.status(200).send({ message: "Credits transferred" });
    } catch (error) {
      await this.createLog(req, 'transferCredits', 'users', 500, req.user?.user_id);
      this.sendError(res, 500, "Error transferring credits");
    }
  }

  
  @describe({
    endpoint: "/users/auth-verification",
    method: "POST",
    description: "Check the verification key for the user",
    responseType: { success: "boolean" },
    query: {
      userId: "The id of the user",
      verificationKey: "The verification key",
    },
    example:
      "POST /api/users/auth-verification?userId=123&verificationKey=abc123",
  })
  @httpPost("/auth-verification")
  async checkVerificationKey(req: Request, res: Response) {
    const { userId, verificationKey } = req.body;
    if (!userId || !verificationKey) {
      await this.createLog(req, 'checkVerificationKey', 'users', 400);
      return this.sendError(res, 400, "Missing userId or verificationKey");
    }
    const user = await this.userService.getUser(userId);
    if (!user) {
      await this.createLog(req, 'checkVerificationKey', 'users', 404, userId);
      return this.sendError(res, 404, "User not found");
    }
    const expectedKey = genVerificationKey(user.user_id);
    const isValid = verificationKey === expectedKey;
    await this.createLog(req, 'checkVerificationKey', 'users', isValid ? 200 : 401, userId);
    res.send({ success: isValid });
  }

  
  @httpPost("/change-role", LoggedCheck.middleware)
  async changeRole(req: AuthenticatedRequest, res: Response) {
    const userId = req.originalUser?.user_id;
    const { role } = req.body;
    if (!userId) {
      await this.createLog(req, 'changeRole', 'users', 401);
      return this.sendError(res, 401, "Unauthorized");
    }
    if (!role || typeof role !== "string") {
      await this.createLog(req, 'changeRole', 'users', 400, userId);
      return this.sendError(res, 400, "Invalid role");
    }
    try {
      const studios = await this.studioService.getUserStudios(userId);
      const roles = [userId, ...studios.map((s) => s.user_id)];
      if (!roles.includes(role)) {
        await this.createLog(req, 'changeRole', 'users', 403, userId);
        return this.sendError(res, 403, "Forbidden: Invalid role");
      }
      res.cookie("role", role, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      await this.createLog(req, 'changeRole', 'users', 200, userId);
      return res.status(200).send({ message: "Role updated successfully" });
    } catch (error) {
      await this.createLog(req, 'changeRole', 'users', 500, userId);
      this.sendError(res, 500, "Error setting role cookie");
    }
  }

  @httpGet("/validate-reset-token")
  public async isValidResetToken(req: Request, res: Response) {
    const { reset_token } = req.query;
    if (!reset_token) {
      await this.createLog(req, 'isValidResetToken', 'users', 400);
      return this.sendError(res, 400, "Missing required fields");
    }
    const user = await this.userService.findByResetToken(reset_token as string);
    if (!user) {
      await this.createLog(req, 'isValidResetToken', 'users', 404);
      return this.sendError(res, 404, "Invalid reset token");
    }
    await this.createLog(req, 'isValidResetToken', 'users', 200, user.user_id);
    res.status(200).send({ message: "Valid reset token", user });
  }
}
