/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Context } from 'hono';
import { inject, injectable } from 'inversify';
import { describe } from '../decorators/describe';
import { controller, httpGet, httpPost } from '../hono-inversify';
import { PublicUser, PublicUserAsAdmin, User } from '../interfaces/User';
import { createRateLimit } from '../middlewares/hono/rateLimit';
import { ILogService } from '../services/LogService';
import { MailService } from '../services/MailService';
import { SteamOAuthService } from '../services/SteamOAuthService';
import { StudioService } from '../services/StudioService';
import { IUserService } from '../services/UserService';
import { genKey, genVerificationKey } from '../utils/GenKey';
import { requireFields } from '../utils/helpers';
import { generateUserJwt } from '../utils/Jwt';
import { userIdParamValidator } from '../validators/UserValidator';

const registerRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 5, 
  message: 'Too many registration attempts from this IP, please try again later.',
  standardHeaders: true, 
  legacyHeaders: false, 
});

const changeUsernameRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10, 
  message: 'Too many username changes, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const changePasswordRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 20, 
  message: 'Too many password changes, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const transferCreditsRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10, 
  message: 'Too many credit transfers, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 5, 
  message: 'Too many password reset requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const resetPasswordRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 5, 
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const loginOAuthRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 100, 
  message: 'Too many OAuth login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const changeRoleRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 500, 
  message: 'Too many role changes, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const unlinkSteamRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 30, 
  message: 'Too many unlink steam requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

@injectable()
@controller('/users')
export class Users {
  constructor(
    @inject('UserService') private userService: IUserService,
    @inject('LogService') private logService: ILogService,
    @inject('MailService') private mailService: MailService,
    @inject('StudioService') private studioService: StudioService,
    @inject('SteamOAuthService') private steamOAuthService: SteamOAuthService
  ) {

    console.log('UserController initialized');
    console.log(userService)
  }

  private sendError(c: Context, status: number, message: string) {
    return c.json({ message }, status as any);
  }

  private async createLog(c: Context, action: string, tableName?: string, statusCode?: number, userId?: string, metadata?: object, body?: any) {
    try {
      let requestBody: any = body || { note: 'Body not provided for logging' };
      
      if (metadata) {
        requestBody = { ...requestBody, metadata };
      }
      
      const clientIP = c.req.header('cf-connecting-ip') || 
                      c.req.header('x-forwarded-for') || 
                      c.req.header('x-real-ip') || 
                      'unknown';
      
      await this.logService.createLog({
        ip_address: clientIP,
        table_name: tableName,
        controller: `UserController.${action}`,
        original_path: c.req.path,
        http_method: c.req.method,
        request_body: JSON.stringify(requestBody),
        user_id: userId,
        status_code: statusCode,
      });
    } catch (error) {
      console.error('Error creating log:', error);
    }
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
      badges: user.badges || [],
      created_at: user.created_at,
    };
  }

  private mapUserSearch(user: PublicUserAsAdmin) {
    return {
      id: user.user_id,
      userId: user.user_id,
      username: user.username,
      verified: user.verified,
      isStudio: user.isStudio,
      admin: !!user.admin,
      badges: user.badges || [],
      disabled: !!user.disabled,
      created_at: user.created_at,
    };
  }

  // Helper pour récupérer l'utilisateur authentifié depuis le context
  private getUserFromContext(c: Context) {
    return c.get('user') as User | undefined;
  }

  // Helper pour récupérer l'utilisateur original depuis le context
  private getOriginalUserFromContext(c: Context) {
    return c.get('originalUser') as User | undefined;
  }

  @httpPost('/login-oauth', loginOAuthRateLimit)
  public async loginOAuth(c: Context) {
    try {
      const body = await c.req.json();
      const { provider, code } = body;
      
      if (!provider || !code) {
        await this.createLog(c, 'loginOAuth', 'users', 400, undefined, undefined, body);
        return this.sendError(c, 400, 'Missing provider or code');
      }

      let accessToken: string | undefined;
      let verifiedUser: { id: string; email: string; username: string };

      if (provider === 'discord') {
        const redirectUri = process.env.DISCORD_CALLBACK_URL!;
        if (!redirectUri) {
          await this.createLog(c, 'loginOAuth', 'users', 500, undefined, undefined, body);
          return this.sendError(c, 500, 'Discord redirect_uri is not set in environment variables');
        }

        const params = new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID!,
          client_secret: process.env.DISCORD_CLIENT_SECRET!,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
        });
        
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        
        if (!tokenRes.ok) {
          const errorText = await tokenRes.text();
          console.error('Discord token error:', errorText);
          console.error('Params sent to Discord:', params.toString());
          await this.createLog(c, 'loginOAuth', 'users', 500, undefined, undefined, body);
          return this.sendError(c, 500, 'Failed to fetch Discord access token: ' + errorText);
        }
        
        const tokenData: any = await tokenRes.json();
        accessToken = tokenData.access_token;
        verifiedUser = await this.verifyDiscordToken(accessToken!);
      } else if (provider === 'google') {
        const params = new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
        });
        
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        
        if (!tokenRes.ok) {
          await this.createLog(c, 'loginOAuth', 'users', 500, undefined, undefined, body);
          return this.sendError(c, 500, 'Failed to fetch Google access token');
        }
        
        const tokenData: any = await tokenRes.json();
        accessToken = tokenData.access_token;
        verifiedUser = await this.verifyGoogleToken(accessToken!);
      } else {
        await this.createLog(c, 'loginOAuth', 'users', 400, undefined, undefined, body);
        return this.sendError(c, 400, 'Unsupported OAuth provider');
      }

      const users = await this.userService.getAllUsersWithDisabled();
      const cookieHeader = c.req.header('cookie');
      const token = cookieHeader?.split('token=')[1]?.split(';')[0];
      let user = await this.userService.authenticateUser(token as string);

      if (!verifiedUser) {
        await this.createLog(c, 'loginOAuth', 'users', 500, undefined, undefined, body);
        return this.sendError(c, 500, 'Failed to verify OAuth user');
      }

      if (!user) {
        user = users.find(u => (provider === 'discord' && u.discord_id == verifiedUser.id) || (provider === 'google' && u.google_id == verifiedUser.id)) || null;
      }

      if (!user) {
        const userId = crypto.randomUUID();
        user = await this.userService.createUser(userId, verifiedUser.username, verifiedUser.email, null, provider, verifiedUser.id);
        await this.createLog(c, 'loginOAuth', 'users', 201, userId, undefined, body);
      } else {
        if ((provider === 'discord' && !user.discord_id) || (provider === 'google' && !user.google_id)) {
          await this.userService.associateOAuth(user.user_id, provider, verifiedUser.id);
        }
        if ((provider === 'discord' && user.discord_id && user.discord_id != verifiedUser.id) || (provider === 'google' && user.google_id && user.google_id != verifiedUser.id)) {
          await this.createLog(c, 'loginOAuth', 'users', 401, user.user_id, undefined, body);
          return this.sendError(c, 401, 'OAuth providerId mismatch');
        }
      }

      if (user.disabled) {
        await this.createLog(c, 'loginOAuth', 'users', 403, user.user_id, undefined, body);
        return this.sendError(c, 403, 'Account is disabled');
      }

      await this.createLog(c, 'loginOAuth', 'users', 200, user.user_id, undefined, body);
      const apiKey = genKey(user.user_id);
      const jwtToken = generateUserJwt(user, apiKey);
      
      return c.json({
        message: 'Login successful',
        token: jwtToken,
        user: {
          userId: user.user_id,
          username: user.username,
          email: user.email,
        },
      }, 200);
    } catch (error) {
      console.error('Error during OAuth login:', error);
      await this.createLog(c, 'loginOAuth', 'users', 500);
      return this.sendError(c, 500, 'Internal server error');
    }
  }

  @httpPost('/register', registerRateLimit)
  public async register(c: Context) {
    try {
      const body = await c.req.json();
      
      const missing = requireFields(body, ['username', 'email']);
      if (missing || (!body.password && !body.provider)) {
        await this.createLog(c, 'register', 'users', 400, undefined, undefined, body);
        return this.sendError(c, 400, 'Missing required fields');
      }

      const users = await this.userService.getAllUsersWithDisabled();
      if (users.find(u => u.email === body.email)) {
        await this.createLog(c, 'register', 'users', 400, undefined, undefined, body);
        return this.sendError(c, 400, 'Email already exists');
      }

      let userId = body.userId;
      if (!userId) {
        userId = crypto.randomUUID();
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        await this.createLog(c, 'register', 'users', 400, undefined, undefined, body);
        return this.sendError(c, 400, 'Invalid email address');
      }
      
      let hashedPassword = null;
      if (body.password) {
        if (typeof body.password !== 'string') {
          await this.createLog(c, 'register', 'users', 400, undefined, undefined, body);
          return this.sendError(c, 400, 'Invalid password');
        }
        hashedPassword = await bcrypt.hash(body.password, 10);
      }

      const user = await this.userService.createUser(
        userId, 
        body.username, 
        body.email, 
        hashedPassword, 
        body.provider, 
        body.providerId
      );
      
      await this.mailService.sendAccountConfirmationMail(user.email);
      await this.createLog(c, 'register', 'users', 201, userId, undefined, body);
      
      const apiKey = genKey(user.user_id);
      const jwtToken = generateUserJwt(user, apiKey);
      
      return c.json({ message: 'User registered', token: jwtToken }, 201);
    } catch (error) {
      console.error('Error registering user', error);
      await this.createLog(c, 'register', 'users', 500);
      return this.sendError(c, 500, 'Error registering user');
    }
  }

  @httpPost('/login', loginRateLimit)
  public async login(c: Context) {
    try {
      const body = await c.req.json();
      
      if (!body.email || !body.password) {
        await this.createLog(c, 'login', 'users', 400, undefined, undefined, body);
        return this.sendError(c, 400, 'Missing email or password');
      }

      const allUsers = await this.userService.getAllUsersWithDisabled();
      const user = allUsers.find(u => u.email === body.email);
      
      if (!user || !user.password) {
        await this.createLog(c, 'login', 'users', 401, undefined, undefined, body);
        return this.sendError(c, 401, 'Invalid credentials');
      }
      
      const valid = await bcrypt.compare(body.password, user.password);
      if (!valid) {
        await this.createLog(c, 'login', 'users', 401, user.user_id, undefined, body);
        return this.sendError(c, 401, 'Invalid credentials');
      }
      
      if (user.disabled) {
        await this.createLog(c, 'login', 'users', 403, user.user_id, undefined, body);
        return this.sendError(c, 403, 'Account is disabled');
      }
      
      // Send connection notification email asynchronously
      this.mailService.sendConnectionNotificationMail(user.email, user.username).catch(err => {
        console.error('Error sending connection notification email', err);
      });

      await this.createLog(c, 'login', 'users', 200, user.user_id, undefined, body);
      
      if (!user.authenticator_secret) {
        const apiKey = genKey(user.user_id);
        const jwtToken = generateUserJwt(user, apiKey);
        return c.json({
          message: 'Login successful',
          token: jwtToken,
        }, 200);
      } else {
        return c.json({
          message: 'Login successful',
          user: {
            userId: user.user_id,
            username: user.username,
            email: user.email,
          },
        }, 200);
      }
    } catch (error) {
      console.error('Error during login:', error);
      await this.createLog(c, 'login', 'users', 500);
      return this.sendError(c, 500, 'Internal server error');
    }
  }

  @describe({
    endpoint: '/users/@me',
    method: 'GET',
    description: "Get the current authenticated user's profile, including studios, roles, inventory, owned items, and created games.",
    responseType: {
      userId: 'string',
      username: 'string',
      email: 'string',
      verified: 'boolean',
      studios: 'array',
      roles: 'array',
      inventory: 'array',
      ownedItems: 'array',
      createdGames: 'array',
      verificationKey: 'string',
    },
    example: 'GET /api/users/@me',
  })
  @httpGet('/@me')
  async getMe(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      const originalUser = this.getOriginalUserFromContext(c);
      
      if (!user) {
        await this.createLog(c, 'getMe', 'users', 401);
        return this.sendError(c, 401, 'Unauthorized');
      }

      const userId = user.user_id;
      const userWithData = await this.userService.getUserWithCompleteProfile(userId);
      
      if (!userWithData) {
        await this.createLog(c, 'getMe', 'users', 404, userId);
        return this.sendError(c, 404, 'User not found');
      }
      
      const studios = await this.studioService.getUserStudios(originalUser?.user_id || userId);
      const roles = [originalUser?.user_id as string, ...studios.map(s => s.user_id)];
      
      await this.createLog(c, 'getMe', 'users', 200, userId);
      
      return c.json({
        ...this.mapUser(userWithData),
        verificationKey: genVerificationKey(userWithData.user_id),
        google_id: userWithData.google_id,
        discord_id: userWithData.discord_id,
        studios: studios.map(s => {
          return {
            ...s,
            id: s.user_id,
            name: s.me.username,
            verified: s.me.verified,
          };
        }),
        roles,
        inventory: userWithData.inventory || [],
        ownedItems: userWithData.ownedItems || [],
        createdGames: userWithData.createdGames || [],
        haveAuthenticator: !!userWithData.authenticator_secret,
      }, 200);
    } catch (error) {
      console.error('Error getting user profile:', error);
      await this.createLog(c, 'getMe', 'users', 500);
      return this.sendError(c, 500, 'Internal server error');
    }
  }

  @httpPost('/change-username', changeUsernameRateLimit)
  public async changeUsername(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user) {
        await this.createLog(c, 'changeUsername', 'users', 401);
        return this.sendError(c, 401, 'Unauthorized');
      }

      const body = await c.req.json();
      const { username } = body;
      const userId = user.user_id;
      
      if (!username || typeof username !== 'string' || username.trim().length < 3) {
        await this.createLog(c, 'changeUsername', 'users', 400, userId, undefined, body);
        return this.sendError(c, 400, 'Invalid username (min 3 characters)');
      }
      
      await this.userService.updateUser(userId, username.trim());
      await this.createLog(c, 'changeUsername', 'users', 200, userId, undefined, body);
      
      return c.json({ message: 'Username updated' }, 200);
    } catch (error) {
      console.error('Error changing username:', error);
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'changeUsername', 'users', 500, user?.user_id);
      return this.sendError(c, 500, 'Error updating username');
    }
  }

  @httpPost('/change-password', changePasswordRateLimit)
  public async changePassword(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user) {
        await this.createLog(c, 'changePassword', 'users', 401);
        return this.sendError(c, 401, 'Unauthorized');
      }

      const body = await c.req.json();
      const { oldPassword, newPassword, confirmPassword } = body;
      const userId = user.user_id;
      
      if (!newPassword || !confirmPassword) {
        await this.createLog(c, 'changePassword', 'users', 400, userId, undefined, body);
        return this.sendError(c, 400, 'Missing newPassword or confirmPassword');
      }
      
      if (newPassword !== confirmPassword) {
        await this.createLog(c, 'changePassword', 'users', 400, userId, undefined, body);
        return this.sendError(c, 400, 'New password and confirm password do not match');
      }

      const fullUser = await this.userService.getUser(userId);
      if (!fullUser) {
        await this.createLog(c, 'changePassword', 'users', 404, userId, undefined, body);
        return this.sendError(c, 404, 'User not found');
      }
      
      let valid = true;
      if (fullUser.password) {
        valid = await bcrypt.compare(oldPassword, fullUser.password);
      }
      
      if (!valid) {
        await this.createLog(c, 'changePassword', 'users', 401, userId, undefined, body);
        return this.sendError(c, 401, 'Invalid current password');
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.userService.updateUserPassword(userId, hashedPassword);
      await this.createLog(c, 'changePassword', 'users', 200, userId, undefined, body);
      
      return c.json({ message: 'Password changed successfully' }, 200);
    } catch (error) {
      console.error('Error changing password:', error);
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'changePassword', 'users', 500, user?.user_id);
      return this.sendError(c, 500, 'Error changing password');
    }
  }

  @httpPost('/forgot-password', forgotPasswordRateLimit)
  public async forgotPassword(c: Context) {
    try {
      const body = await c.req.json();
      const { email } = body;
      
      if (!email) {
        await this.createLog(c, 'forgotPassword', 'users', 400, undefined, undefined, body);
        return this.sendError(c, 400, 'Email is required');
      }
      
      const user = await this.userService.findByEmail(email);
      if (!user) {
        await this.createLog(c, 'forgotPassword', 'users', 404, undefined, undefined, body);
        return this.sendError(c, 404, 'Invalid email');
      }
      
      const passwordResetToken = await this.userService.generatePasswordResetToken(email);
      await this.mailService.sendPasswordResetMail(email, passwordResetToken);
      await this.createLog(c, 'forgotPassword', 'users', 200, user.user_id, undefined, body);
      
      return c.json({ message: 'Password reset email sent' }, 200);
    } catch (error) {
      console.error('Error in forgot password:', error);
      await this.createLog(c, 'forgotPassword', 'users', 500);
      return this.sendError(c, 500, 'Internal server error');
    }
  }

  @httpPost('/reset-password', resetPasswordRateLimit)
  public async resetPassword(c: Context) {
    try {
      const body = await c.req.json();
      const { new_password, confirm_password, reset_token } = body;
      
      if (!new_password || !reset_token || !confirm_password) {
        await this.createLog(c, 'resetPassword', 'users', 400, undefined, undefined, body);
        return this.sendError(c, 400, 'Missing required fields');
      }
      
      if (new_password !== confirm_password) {
        await this.createLog(c, 'resetPassword', 'users', 400, undefined, undefined, body);
        return this.sendError(c, 400, 'New password and confirm password do not match');
      }
      
      const user = await this.userService.findByResetToken(reset_token);
      if (!user) {
        await this.createLog(c, 'resetPassword', 'users', 404, undefined, undefined, body);
        return this.sendError(c, 404, 'Invalid user');
      }
      
      const hashedPassword = await bcrypt.hash(new_password, 10);
      await this.userService.updateUserPassword(user.user_id, hashedPassword);
      await this.createLog(c, 'resetPassword', 'users', 200, user.user_id, undefined, body);
      
      const apiKey = genKey(user.user_id);
      const jwtToken = generateUserJwt(user, apiKey);
      
      return c.json({ message: 'Password reset successfully', token: jwtToken }, 200);
    } catch (error) {
      console.error('Error resetting password:', error);
      await this.createLog(c, 'resetPassword', 'users', 500);
      return this.sendError(c, 500, 'Error resetting password');
    }
  }

  @httpGet('/validate-reset-token')
  public async isValidResetToken(c: Context) {
    try {
      const { reset_token } = c.req.query();
      
      if (!reset_token) {
        await this.createLog(c, 'isValidResetToken', 'users', 400);
        return this.sendError(c, 400, 'Missing required fields');
      }
      
      const user = await this.userService.findByResetToken(reset_token as string);
      if (!user) {
        await this.createLog(c, 'isValidResetToken', 'users', 404);
        return this.sendError(c, 404, 'Invalid reset token');
      }
      
      await this.createLog(c, 'isValidResetToken', 'users', 200, user.user_id);
      return c.json({ message: 'Valid reset token', user }, 200);
    } catch (error) {
      console.error('Error validating reset token:', error);
      await this.createLog(c, 'isValidResetToken', 'users', 500);
      return this.sendError(c, 500, 'Internal server error');
    }
  }

  @httpGet('/steam-redirect')
  public async steamRedirect(c: Context) {
    try {
      const url = this.steamOAuthService.getAuthUrl();
      await this.createLog(c, 'steamRedirect', 'users', 200);
      return c.json(url, 200);
    } catch (error) {
      console.error('Error getting Steam redirect URL:', error);
      await this.createLog(c, 'steamRedirect', 'users', 500);
      return this.sendError(c, 500, 'Internal server error');
    }
  }

  @httpGet('/steam-associate')
  public async steamAssociate(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user) {
        await this.createLog(c, 'steamAssociate', 'users', 401);
        return this.sendError(c, 401, 'Unauthorized');
      }

      const query = c.req.query();
      const steamId = await this.steamOAuthService.verifySteamOpenId(query as Record<string, string | string[]>);
      
      if (!steamId) {
        await this.createLog(c, 'steamAssociate', 'users', 400, user.user_id);
        return this.sendError(c, 400, 'Steam authentication failed');
      }
      
      const profile = await this.steamOAuthService.getSteamProfile(steamId);
      if (!profile) {
        await this.createLog(c, 'steamAssociate', 'users', 400, user.user_id);
        return this.sendError(c, 400, 'Unable to fetch Steam profile');
      }
      
      await this.userService.updateSteamFields(user.user_id, profile.steamid, profile.personaname, profile.avatarfull);
      await this.createLog(c, 'steamAssociate', 'users', 200, user.user_id);
      
      // Retourner du HTML pour la redirection
      const html = `<html><head><meta http-equiv="refresh" content="0;url=/settings"></head><body>Redirecting to <a href="/settings">/settings</a>...</body></html>`;
      return c.html(html);
    } catch (error) {
      console.error('Error associating Steam account', error);
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'steamAssociate', 'users', 500, user?.user_id);
      return this.sendError(c, 500, 'Internal server error');
    }
  }

  @httpPost('/unlink-steam', unlinkSteamRateLimit)
  public async unlinkSteam(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user) {
        await this.createLog(c, 'unlinkSteam', 'users', 401);
        return this.sendError(c, 401, 'Unauthorized');
      }

      const userId = user.user_id;
      await this.userService.updateSteamFields(userId, null, null, null);
      await this.createLog(c, 'unlinkSteam', 'users', 200, userId);
      
      return c.json({ message: 'Steam account unlinked' }, 200);
    } catch (error) {
      console.error('Error unlinking Steam account', error);
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'unlinkSteam', 'users', 500, user?.user_id);
      return this.sendError(c, 500, 'Error unlinking Steam account');
    }
  }

  @describe({
    endpoint: '/users/search',
    method: 'GET',
    description: 'Search for users by username',
    query: { q: 'The search query' },
    responseType: [
      {
        userId: 'string',
        username: 'string',
        verified: 'boolean',
        steam_id: 'string',
        steam_username: 'string',
        steam_avatar_url: 'string',
        isStudio: 'boolean',
        admin: 'boolean',
        inventory: 'array',
        ownedItems: 'array',
        createdGames: 'array',
      },
    ],
    example: 'GET /api/users/search?q=John',
  })
  @httpGet('/search')
  public async searchUsers(c: Context) {
    try {
      const { q } = c.req.query();
      const query = (q as string)?.trim();
      
      if (!query) {
        await this.createLog(c, 'searchUsers', 'users', 400);
        return this.sendError(c, 400, 'Missing search query');
      }
      
      const usersRaw = await this.userService.searchUsersByUsername(query);
      const users = usersRaw.filter(user => {
        return !('disabled' in user) || !user['disabled'];
      });
      
      await this.createLog(c, 'searchUsers', 'users', 200);
      return c.json(users.map(user => this.mapUserSearch(user)), 200);
    } catch (error) {
      console.error('Error searching users:', error);
      await this.createLog(c, 'searchUsers', 'users', 500);
      return this.sendError(c, 500, 'Error searching users');
    }
  }

  @describe({
    endpoint: '/users/:userId',
    method: 'GET',
    description: 'Get a user by userId, userId can be a Croissant ID, Discord ID, Google ID or Steam ID',
    params: { userId: 'The id of the user' },
    responseType: {
      userId: 'string',
      username: 'string',
      verified: 'boolean',
      steam_id: 'string',
      steam_username: 'string',
      steam_avatar_url: 'string',
      isStudio: 'boolean',
      studios: 'array',
      admin: 'boolean',
      inventory: 'array',
      ownedItems: 'array',
      createdGames: 'array',
    },
    example: 'GET /api/users/123',
  })
  @httpGet('/:userId')
  public async getUser(c: Context) {
    try {
      const { userId } = c.req.param();
      
      try {
        await userIdParamValidator.validate({ userId });
      } catch {
        await this.createLog(c, 'getUser', 'users', 400);
        return this.sendError(c, 400, 'Invalid userId');
      }

      const userWithData = await this.userService.getUserWithPublicProfile(userId);

      if (!userWithData || ('disabled' in userWithData && userWithData['disabled'])) {
        await this.createLog(c, 'getUser', 'users', 404);
        return this.sendError(c, 404, 'User not found');
      }
      
      await this.createLog(c, 'getUser', 'users', 200);
      const studios = await this.studioService.getUserStudios(userId);
      
      return c.json({
        ...this.mapUserSearch(userWithData),
        studios: studios.map(s => {
          return {
            id: s.user_id,
            name: s.me.username,
            verified: s.me.verified,
          };
        }),
        inventory: userWithData.inventory || [],
        ownedItems: userWithData.ownedItems || [],
        createdGames: userWithData.createdGames || [],
      }, 200);
    } catch (error) {
      console.error('Error getting user:', error);
      await this.createLog(c, 'getUser', 'users', 500);
      return this.sendError(c, 500, error instanceof Error ? error.message : 'Error getting user');
    }
  }

  @httpGet('/admin/search')
  public async adminSearchUsers(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user?.admin) {
        await this.createLog(c, 'adminSearchUsers', 'users', 403, user?.user_id);
        return this.sendError(c, 403, 'Forbidden');
      }

      const { q } = c.req.query();
      const query = (q as string)?.trim();
      
      if (!query) {
        await this.createLog(c, 'adminSearchUsers', 'users', 400, user.user_id);
        return this.sendError(c, 400, 'Missing search query');
      }
      
      const users: PublicUser[] = await this.userService.adminSearchUsers(query);
      await this.createLog(c, 'adminSearchUsers', 'users', 200, user.user_id);
      
      return c.json(users.map(user => this.mapUserSearch(user)), 200);
    } catch (error) {
      console.error('Error in admin search users:', error);
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'adminSearchUsers', 'users', 500, user?.user_id);
      return this.sendError(c, 500, 'Error searching users');
    }
  }

  @httpPost('/admin/disable/:userId')
  public async disableAccount(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user?.admin) {
        await this.createLog(c, 'disableAccount', 'users', 403, user?.user_id);
        return this.sendError(c, 403, 'Forbidden');
      }

      const { userId } = c.req.param();
      const adminUserId = user.user_id;
      
      if (adminUserId === userId) {
        await this.createLog(c, 'disableAccount', 'users', 400, adminUserId);
        return this.sendError(c, 400, 'Vous ne pouvez pas désactiver votre propre compte.');
      }
      
      await this.userService.disableAccount(userId, adminUserId);
      await this.createLog(c, 'disableAccount', 'users', 200, adminUserId);
      
      return c.json({ message: 'Account disabled' }, 200);
    } catch (error) {
      console.error('Error disabling account:', error);
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'disableAccount', 'users', 403, user?.user_id);
      return this.sendError(c, 403, error instanceof Error ? error.message : String(error));
    }
  }

  @httpPost('/admin/enable/:userId')
  public async reenableAccount(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user?.admin) {
        await this.createLog(c, 'reenableAccount', 'users', 403, user?.user_id);
        return this.sendError(c, 403, 'Forbidden');
      }

      const { userId } = c.req.param();
      const adminUserId = user.user_id;
      
      if (adminUserId === userId) {
        await this.createLog(c, 'reenableAccount', 'users', 400, adminUserId);
        return this.sendError(c, 400, 'Vous ne pouvez pas réactiver votre propre compte.');
      }
      
      await this.userService.reenableAccount(userId, adminUserId);
      await this.createLog(c, 'reenableAccount', 'users', 200, adminUserId);
      
      return c.json({ message: 'Account re-enabled' }, 200);
    } catch (error) {
      console.error('Error re-enabling account:', error);
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'reenableAccount', 'users', 403, user?.user_id);
      return this.sendError(c, 403, error instanceof Error ? error.message : String(error));
    }
  }

  @httpGet('/admin/:userId')
  public async adminGetUser(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user?.admin) {
        await this.createLog(c, 'adminGetUser', 'users', 403, user?.user_id);
        return this.sendError(c, 403, 'Forbidden');
      }

      const { userId } = c.req.param();
      
      try {
        await userIdParamValidator.validate({ userId });
      } catch {
        await this.createLog(c, 'adminGetUser', 'users', 400, user?.user_id);
        return this.sendError(c, 400, 'Invalid userId');
      }

      const userWithData = await this.userService.adminGetUserWithProfile(userId);
      if (!userWithData) {
        await this.createLog(c, 'adminGetUser', 'users', 404, user?.user_id);
        return this.sendError(c, 404, 'User not found');
      }
      
      await this.createLog(c, 'adminGetUser', 'users', 200, user?.user_id);
      
      return c.json({
        ...this.mapUserSearch(userWithData),
        disabled: userWithData.disabled,
        inventory: userWithData.inventory || [],
        ownedItems: userWithData.ownedItems || [],
        createdGames: userWithData.createdGames || [],
      }, 200);
    } catch (error) {
      console.error('Error in admin get user:', error);
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'adminGetUser', 'users', 500, user?.user_id);
      return this.sendError(c, 500, 'Internal server error');
    }
  }

  @describe({
    endpoint: '/users/transfer-credits',
    method: 'POST',
    description: 'Transfer credits from one user to another',
    body: {
      targetUserId: 'The id of the recipient',
      amount: 'The amount to transfer',
    },
    responseType: { message: 'string' },
    example: "POST /api/users/transfer-credits { targetUserId: '456', amount: 50 }",
    requiresAuth: true,
  })
  @httpPost('/transfer-credits', transferCreditsRateLimit)
  public async transferCredits(c: Context) {
    try {
      const user = this.getUserFromContext(c);
      
      if (!user) {
        await this.createLog(c, 'transferCredits', 'users', 401);
        return this.sendError(c, 401, 'Unauthorized');
      }

      const body = await c.req.json();
      const { targetUserId, amount } = body;
      const transferAmount = Number(amount);
      
      if (!targetUserId || isNaN(transferAmount) || transferAmount <= 0) {
        await this.createLog(c, 'transferCredits', 'users', 400, user.user_id, undefined, body);
        return this.sendError(c, 400, 'Invalid input');
      }

      const sender = user;
      if (sender.user_id === targetUserId) {
        await this.createLog(c, 'transferCredits', 'users', 400, sender.user_id, undefined, body);
        return this.sendError(c, 400, 'Cannot transfer credits to yourself');
      }
      
      const recipient = await this.userService.getUser(targetUserId);
      if (!recipient) {
        await this.createLog(c, 'transferCredits', 'users', 404, sender.user_id, undefined, body);
        return this.sendError(c, 404, 'Recipient not found');
      }
      
      if (sender.balance < transferAmount) {
        await this.createLog(c, 'transferCredits', 'users', 400, sender.user_id, undefined, body);
        return this.sendError(c, 400, 'Insufficient balance');
      }
      
      await this.userService.updateUserBalance(sender.user_id, sender.balance - transferAmount);
      await this.userService.updateUserBalance(recipient.user_id, recipient.balance + transferAmount);
      await this.createLog(c, 'transferCredits', 'users', 200, sender.user_id, undefined, body);
      
      return c.json({ message: 'Credits transferred' }, 200);
    } catch (error) {
      console.error('Error transferring credits:', error);
      const user = this.getUserFromContext(c);
      await this.createLog(c, 'transferCredits', 'users', 500, user?.user_id);
      return this.sendError(c, 500, 'Error transferring credits');
    }
  }

  @describe({
    endpoint: '/users/auth-verification',
    method: 'POST',
    description: 'Check the verification key for the user',
    responseType: { success: 'boolean' },
    query: {
      userId: 'The id of the user',
      verificationKey: 'The verification key',
    },
    example: 'POST /api/users/auth-verification?userId=123&verificationKey=abc123',
  })
  @httpPost('/auth-verification')
  async checkVerificationKey(c: Context) {
    try {
      const body = await c.req.json();
      const { userId, verificationKey } = body;
      
      if (!userId || !verificationKey) {
        await this.createLog(c, 'checkVerificationKey', 'users', 400, undefined, undefined, body);
        return this.sendError(c, 400, 'Missing userId or verificationKey');
      }
      
      const user = await this.userService.getUser(userId);
      if (!user) {
        await this.createLog(c, 'checkVerificationKey', 'users', 404, userId, undefined, body);
        return this.sendError(c, 404, 'User not found');
      }
      
      const expectedKey = genVerificationKey(user.user_id);
      const isValid = verificationKey === expectedKey;
      await this.createLog(c, 'checkVerificationKey', 'users', isValid ? 200 : 401, userId, undefined, body);
      
      return c.json({ success: isValid }, isValid ? 200 : 401);
    } catch (error) {
      console.error('Error checking verification key:', error);
      await this.createLog(c, 'checkVerificationKey', 'users', 500);
      return this.sendError(c, 500, 'Internal server error');
    }
  }

  @httpPost('/change-role', changeRoleRateLimit)
  async changeRole(c: Context) {
    try {
      const originalUser = this.getOriginalUserFromContext(c);
      
      if (!originalUser) {
        await this.createLog(c, 'changeRole', 'users', 401);
        return this.sendError(c, 401, 'Unauthorized');
      }

      const body = await c.req.json();
      const { role } = body;
      const userId = originalUser.user_id;
      
      if (!role || typeof role !== 'string') {
        await this.createLog(c, 'changeRole', 'users', 400, userId, undefined, body);
        return this.sendError(c, 400, 'Invalid role');
      }
      
      const studios = await this.studioService.getUserStudios(userId);
      const roles = [userId, ...studios.map(s => s.user_id)];
      
      if (!roles.includes(role)) {
        await this.createLog(c, 'changeRole', 'users', 403, userId, undefined, body);
        return this.sendError(c, 403, 'Forbidden: Invalid role');
      }
      
      // Dans Hono pour Cloudflare Workers, nous ne pouvons pas directement définir des cookies HTTP
      // Nous renvoyons simplement la confirmation
      await this.createLog(c, 'changeRole', 'users', 200, userId, undefined, body);
      
      return c.json({ 
        message: 'Role updated successfully',
        role: role 
      }, 200);
    } catch (error) {
      console.error('Error changing role:', error);
      const originalUser = this.getOriginalUserFromContext(c);
      await this.createLog(c, 'changeRole', 'users', 500, originalUser?.user_id);
      return this.sendError(c, 500, 'Error setting role');
    }
  }

  private async verifyDiscordToken(accessToken: string) {
    try {
      const response = await fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid Discord token');
      }

      const userData: {id: string, email: string, username: string} = await response.json();
      return {
        id: userData.id,
        email: userData.email,
        username: userData.username,
      };
    } catch {
      throw new Error('Failed to verify Discord token');
    }
  }

  private async verifyGoogleToken(accessToken: string) {
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);

      if (!response.ok) {
        throw new Error('Invalid Google token');
      }

      const userData: {id: string, email: string, name: string} = await response.json();
      return {
        id: userData.id,
        email: userData.email,
        username: userData.name,
      };
    } catch {
      throw new Error('Failed to verify Google token');
    }
  }
}


