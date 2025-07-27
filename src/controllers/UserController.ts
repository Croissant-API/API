import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { inject } from "inversify";
import crypto from "crypto";
import { controller, httpGet, httpPost } from "inversify-express-utils";
import { IUserService } from "../services/UserService";
import { userIdParamValidator } from "../validators/UserValidator";
import { describe } from "../decorators/describe";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { genKey, genVerificationKey } from "../utils/GenKey";
import { User } from "../interfaces/User";
import { SteamOAuthService } from "../services/SteamOAuthService";
import { MailService } from "../services/MailService";
import { StudioService } from "../services/StudioService";
import { IInventoryService } from "../services/InventoryService";
import { IItemService } from "../services/ItemService";
import { IGameService } from "../services/GameService";
import { requireFields, sendError, formatInventory, mapItem, filterGame, mapUser, mapUserSearch, findUserByResetToken } from "../utils/helpers";

@controller("/users")
export class Users {
  constructor(
    @inject("UserService") private userService: IUserService,
    @inject("SteamOAuthService") private steamOAuthService: SteamOAuthService,
    @inject("MailService") private mailService: MailService,
    @inject("StudioService") private studioService: StudioService,
    @inject("InventoryService") private inventoryService: IInventoryService,
    @inject("ItemService") private itemService: IItemService,
    @inject("GameService") private gameService: IGameService
  ) { }

  // --- AUTHENTIFICATION & INSCRIPTION ---
  @httpPost("/login-oauth")
  public async loginOAuth(req: Request, res: Response) {
    const { email, provider, providerId, username } = req.body;
    if (!email || !provider || !providerId) {
      return res
        .status(400)
        .send({ message: "Missing email, provider or providerId" });
    }
    // Vérifie si l'utilisateur existe par email
    // let user = await this.userService.findByEmail(email);
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
      // Création d'un nouvel utilisateur si non existant
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
    } else {
      // Si l'association n'existe pas, on l'ajoute
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
      // Vérifie que l'id provider correspond bien
      if (
        (provider === "discord" &&
          user.discord_id &&
          user.discord_id !== providerId) ||
        (provider === "google" &&
          user.google_id &&
          user.google_id !== providerId)
      ) {
        return res.status(401).send({ message: "OAuth providerId mismatch" });
      }
    }
    if (user.disabled) {
      return res.status(403).send({ message: "Account is disabled" });
    }
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
    const missing = requireFields(req.body, ["username", "email"]);
    if (missing || (!req.body.password && !req.body.provider)) {
      return sendError(res, 400, "Missing required fields");
    }

    const users = await this.userService.getAllUsersWithDisabled();
    if (users.find((u) => u.email === req.body.email)) {
      return sendError(res, 400, "Email already exists");
    }

    let userId = req.body.userId;
    if (!userId) {
      userId = crypto.randomUUID();
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
      return sendError(res, 400, "Invalid email address");
    }
    let hashedPassword = null;
    if (req.body.password) {
      hashedPassword = await bcrypt.hash(req.body.password, 10);
    }
    try {
      // Crée ou associe l'utilisateur selon l'email et provider
      const user = await this.userService.createUser(
        userId,
        req.body.username,
        req.body.email,
        hashedPassword,
        req.body.provider,
        req.body.providerId
      );
      await this.mailService.sendAccountConfirmationMail(user.email);
      res
        .status(201)
        .send({ message: "User registered", token: genKey(user.user_id) });
    } catch (error) {
      console.error("Error registering user", error);
      const message = error instanceof Error ? error.message : String(error);
      sendError(res, 500, "Error registering user", message);
    }
  }

  @httpPost("/login")
  public async login(req: Request, res: Response) {
    const missing = requireFields(req.body, ["email", "password"]);
    if (missing) return sendError(res, 400, "Missing email or password");
    const allUsers = await this.userService.getAllUsersWithDisabled();
    const user = allUsers.find((u) => u.email === req.body.email);
    if (!user || !user.password) {
      return sendError(res, 401, "Invalid credentials");
    }
    // bcrypt importé en haut
    const valid = await bcrypt.compare(req.body.password, user.password);
    if (!valid) {
      return sendError(res, 401, "Invalid credentials");
    }
    // Check si le compte est désactivé
    if (user.disabled) {
      return sendError(res, 403, "Account is disabled");
    }
    this.mailService
      .sendConnectionNotificationMail(user.email, user.username)
      .catch((err) => {
        console.error("Error sending connection notification email", err);
      });
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

  // --- GESTION DU PROFIL UTILISATEUR ---
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
    if (!userId) return sendError(res, 401, "Unauthorized");
    const user = await this.userService.getUser(userId);
    if (!user) return sendError(res, 404, "User not found");
    const studios = await this.studioService.getUserStudios(req.originalUser?.user_id || user.user_id);
    const roles = [req.originalUser?.user_id as string, ...studios.map((s) => s.user_id)];

    const { inventory } = await this.inventoryService.getInventory(userId);
    const formattedInventory = await formatInventory(inventory, this.itemService);
    const items = await this.itemService.getAllItems();
    const ownedItems = items.filter((i) => !i.deleted && i.owner === userId && !!i.showInStore).map(mapItem);
    const games = await this.gameService.listGames();
    const createdGames = games.filter(g => g.owner_id === userId && !!g.showInStore).map(g => filterGame(g, userId, userId));
    res.send({ ...mapUser(user), verificationKey: genVerificationKey(user.user_id), google_id: user.google_id, discord_id: user.discord_id, studios, roles, inventory: formattedInventory, ownedItems, createdGames, haveAuthenticator: !!user.authenticator_secret });
  }

  @httpPost("/change-username", LoggedCheck.middleware)
  public async changeUsername(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.user_id;
    const { username } = req.body;
    if (!userId) return sendError(res, 401, "Unauthorized");
    if (!username || typeof username !== "string" || username.trim().length < 3) {
      return sendError(res, 400, "Invalid username (min 3 characters)");
    }
    try {
      await this.userService.updateUser(userId, username.trim());
      res.status(200).send({ message: "Username updated" });
    } catch (error) {
      sendError(res, 500, "Error updating username", (error as Error).message);
    }
  }

  @httpPost("/change-password", LoggedCheck.middleware)
  public async changePassword(req: AuthenticatedRequest, res: Response) {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (!newPassword || !confirmPassword) return sendError(res, 400, "Missing newPassword or confirmPassword");
    if (newPassword !== confirmPassword) return sendError(res, 400, "New password and confirm password do not match");
    const userId = req.user?.user_id;
    if (!userId) return sendError(res, 401, "Unauthorized");
    const user = await this.userService.getUser(userId);
    if (!user) return sendError(res, 404, "User not found");
    let valid = true;
    if (user.password) valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return sendError(res, 401, "Invalid current password");
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    try {
      await this.userService.updateUserPassword(userId, hashedPassword);
      res.status(200).send({ message: "Password changed successfully" });
    } catch (error) {
      sendError(res, 500, "Error changing password", (error as Error).message);
    }
  }

  @httpPost("/forgot-password")
  public async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    if (!email) return sendError(res, 400, "Email is required");
    const user = await this.userService.findByEmail(email);
    if (!user) return sendError(res, 404, "Invalid email");
    const passwordResetToken = await this.userService.generatePasswordResetToken(email);
    await this.mailService.sendPasswordResetMail(email, passwordResetToken);
    res.status(200).send({ message: "Password reset email sent" });
  }

  @httpPost("/reset-password")
  public async resetPassword(req: Request, res: Response) {
    const { new_password, confirm_password, reset_token } = req.body;
    if (!new_password || !reset_token || !confirm_password) return sendError(res, 400, "Missing required fields");
    if (new_password !== confirm_password) return sendError(res, 400, "New password and confirm password do not match");
    const allUsers = await this.userService.getAllUsersWithDisabled();
    const user = allUsers.find((u) => u.forgot_password_token === reset_token);
    if (!user) return sendError(res, 404, "Invalid user");
    const hashedPassword = await bcrypt.hash(new_password, 10);
    try {
      await this.userService.updateUserPassword(user.user_id, hashedPassword);
      res.status(200).send({ message: "Password reset successfully", token: genKey(user.user_id) });
    } catch (error) {
      sendError(res, 500, "Error resetting password", (error as Error).message);
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
      const steamId = await this.steamOAuthService.verifySteamOpenId(
        req.query as Record<string, string | string[]>
      );
      if (!steamId) {
        return res.status(400).send({ message: "Steam authentication failed" });
      }
      // Récupère le profil Steam
      const profile = await this.steamOAuthService.getSteamProfile(steamId);
      if (!profile) {
        return res
          .status(400)
          .send({ message: "Unable to fetch Steam profile" });
      }
      // Met à jour l'utilisateur avec les infos Steam
      await this.userService.updateSteamFields(
        user.user_id,
        profile.steamid,
        profile.personaname,
        profile.avatarfull
      );
      // Redirige vers /settings (front-end route)
      res.send(
        `<html><head><meta http-equiv="refresh" content="0;url=/settings"></head><body>Redirecting to <a href="/settings">/settings</a>...</body></html>`
      );
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
      const message = error instanceof Error ? error.message : String(error);
      sendError(res, 500, "Error unlinking Steam account", message);
    }
  }

  // --- RECHERCHE & LECTURE D'UTILISATEURS ---
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
    if (!query) return sendError(res, 400, "Missing search query");
    try {
      const users: User[] = await this.userService.searchUsersByUsername(query);
      res.send(users.map(mapUserSearch));
    } catch (error) {
      sendError(res, 500, "Error searching users", (error as Error).message);
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
      return sendError(res, 400, "Invalid userId", err);
    }
    const { userId } = req.params;
    const user = await this.userService.getUser(userId);
    if (!user) return sendError(res, 404, "User not found");

    const { inventory } = await this.inventoryService.getInventory(userId);
    const formattedInventory = await formatInventory(inventory, this.itemService);
    const items = await this.itemService.getAllItems();
    const ownedItems = items.filter((i) => !i.deleted && i.owner === userId && !!i.showInStore).map(mapItem);
    const games = await this.gameService.listGames();
    const createdGames = games.filter(g => g.owner_id === userId && !!g.showInStore).map(g => filterGame(g, userId, ""));
    res.send({ ...mapUserSearch(user), inventory: formattedInventory, ownedItems, createdGames });
  }

  // --- ACTIONS ADMINISTRATIVES ---
  @httpGet("/admin/search", LoggedCheck.middleware)
  public async adminSearchUsers(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: "Forbidden" });
    }
    const query = (req.query.q as string)?.trim();
    if (!query) return sendError(res, 400, "Missing search query");
    try {
      const users: User[] = await this.userService.adminSearchUsers(query);
      res.send(users.map(mapUserSearch));
    } catch (error) {
      sendError(res, 500, "Error searching users", (error as Error).message);
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
      return res.status(401).send({ message: "Unauthorized" });
    }
    try {
      await this.userService.reenableAccount(userId, adminUserId);
      res.status(200).send({ message: "Account re-enabled" });
    } catch (error) {
      res.status(403).send({
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @httpGet("/admin/:userId", LoggedCheck.middleware)
  public async adminGetUser(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: "Forbidden" });
    }
    try {
      await userIdParamValidator.validate(req.params);
    } catch (err) {
      return sendError(res, 400, "Invalid userId", err);
    }
    const { userId } = req.params;
    const user = await this.userService.adminGetUser(userId);
    if (!user) return sendError(res, 404, "User not found");

    const { inventory } = await this.inventoryService.getInventory(userId);
    const formattedInventory = await formatInventory(inventory, this.itemService);
    const items = await this.itemService.getAllItems();
    const ownedItems = items.filter((i) => !i.deleted && i.owner === userId && !!i.showInStore).map(mapItem);
    const games = await this.gameService.listGames();
    const createdGames = games.filter(g => g.owner_id === userId && !!g.showInStore).map(g => filterGame(g, userId, ""));
    res.send({ ...mapUserSearch(user), disabled: user.disabled, inventory: formattedInventory, ownedItems, createdGames });
  }

  // --- ACTIONS DIVERSES ---
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
    if (!targetUserId || isNaN(amount) || amount <= 0) return sendError(res, 400, "Invalid input");
    try {
      const sender = req.user;
      if (!sender) return sendError(res, 401, "Unauthorized");
      if (sender.user_id === targetUserId) return sendError(res, 400, "Cannot transfer credits to yourself");
      const recipient = await this.userService.getUser(targetUserId);
      if (!recipient) return sendError(res, 404, "Recipient not found");
      if (sender.balance < amount) return sendError(res, 400, "Insufficient balance");
      await this.userService.updateUserBalance(sender.user_id, sender.balance - Number(amount));
      await this.userService.updateUserBalance(recipient.user_id, recipient.balance + Number(amount));
      res.status(200).send({ message: "Credits transferred" });
    } catch (error) {
      sendError(res, 500, "Error transferring credits", (error as Error).message);
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
    if (!userId || !verificationKey) return sendError(res, 400, "Missing userId or verificationKey");
    const user = await this.userService.getUser(userId);
    if (!user) return sendError(res, 404, "User not found");
    const expectedKey = genVerificationKey(user.user_id);
    res.send({ success: verificationKey === expectedKey });
  }

  @httpPost("/change-role", LoggedCheck.middleware)
  async changeRole(req: AuthenticatedRequest, res: Response) {
    const userId = req.originalUser?.user_id;
    const { role } = req.body;
    if (!userId) return sendError(res, 401, "Unauthorized");
    if (!role || typeof role !== "string") return sendError(res, 400, "Invalid role");
    try {
      const studios = await this.studioService.getUserStudios(userId);
      const roles = [userId, ...studios.map((s) => s.user_id)];
      if (!roles.includes(role)) return sendError(res, 403, "Forbidden: Invalid role");
      res.cookie("role", role, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      return res.status(200).send({ message: "Role updated successfully" });
    } catch (error) {
      sendError(res, 500, "Error setting role cookie", (error as Error).message);
    }
  }

  @httpGet("/validate-reset-token")
  public async isValidResetToken(req: Request, res: Response) {
    const { reset_token } = req.query;
    if (!reset_token) return sendError(res, 400, "Missing required fields");
    const users = await this.userService.getAllUsersWithDisabled();
    const user = findUserByResetToken(users, reset_token as string);
    if (!user) return sendError(res, 404, "Invalid reset token");
    res.status(200).send({ message: "Valid reset token", user });
  }
}
