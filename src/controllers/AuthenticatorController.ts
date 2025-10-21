/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono';
import { inject, injectable } from 'inversify';
import * as qrcode from 'qrcode';
import { Totp } from 'time2fa';
import { controller, httpPost } from '../hono-inversify';
import { LoggedCheck } from '../middlewares/LoggedCheck';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
import { genKey } from '../utils/GenKey';
import { generateUserJwt } from '../utils/Jwt';

@injectable()
@controller('/authenticator')
export class AuthenticatorController {
  constructor(
    @inject('UserService') private userService: IUserService,
    @inject('LogService') private logService: ILogService
  ) {}

  private async logAction(c: Context, action: string, statusCode: number, metadata?: object) {
    try {
      const requestBody = (await c.req.json().catch(() => ({}))) || {};
      if (metadata) Object.assign(requestBody, { metadata });
      await this.logService.createLog({
        ip_address: c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
        table_name: 'authenticator',
        controller: `AuthenticatorController.${action}`,
        original_path: c.req.path,
        http_method: c.req.method,
        request_body: requestBody,
        user_id: this.getUserFromContext(c)?.user_id,
        status_code: statusCode,
      });
    } catch (error) {
      console.error('Error creating log:', error);
    }
  }

  private sendError(c: Context, status: number, message: string, error?: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return c.json({ message, error: msg }, status as any);
  }

  private getUserFromContext(c: Context) {
    return c.get('user');
  }

  @httpPost('/verifyKey')
  public async verifyKey(c: Context) {
    const { code, userId } = await c.req.json();
    if (!userId) {
      await this.logAction(c, 'verifyKey', 400);
      return this.sendError(c, 400, 'User ID is required');
    }
    try {
      const user = await this.userService.getUser(userId);
      if (!user) {
        await this.logAction(c, 'verifyKey', 404);
        return this.sendError(c, 404, 'User not found');
      }
      const key = user.authenticator_secret;
      if (!key || !code) {
        await this.logAction(c, 'verifyKey', 400);
        return this.sendError(c, 400, 'Key and code are required');
      }
      const isValid = Totp.validate({ secret: key, passcode: code });
      if (isValid) {
        await this.logAction(c, 'verifyKey', 200);
        const apiKey = genKey(user.user_id);
        const jwtToken = generateUserJwt(user, apiKey);
        return c.json({ message: 'Key verified successfully', token: jwtToken }, 200);
      } else {
        await this.logAction(c, 'verifyKey', 400);
        return this.sendError(c, 400, 'Invalid key or code');
      }
    } catch (error) {
      await this.logAction(c, 'verifyKey', 500, { error });
      return this.sendError(c, 500, 'Error verifying key', error);
    }
  }

  @httpPost('/:action', LoggedCheck)
  public async handleAuthenticatorActions(c: Context) {
    const action = c.req.param('action');
    const user = this.getUserFromContext(c);
    try {
      switch (action) {
        case 'generateKey': {
          if (!user || !user.email) {
            await this.logAction(c, 'generateKey', 400);
            return this.sendError(c, 400, 'User not authenticated or email missing');
          }
          const key = Totp.generateKey({ issuer: 'Croissant API', user: user.email });
          const qrCode = await qrcode.toDataURL(key.url);
          await this.logAction(c, 'generateKey', 200);
          return c.json({ key, qrCode }, 200);
        }

        case 'registerKey': {
          const { key: regKey, passcode } = await c.req.json();
          if (!user || !user.email || !regKey) {
            await this.logAction(c, 'registerKey', 400);
            return this.sendError(c, 400, 'User not authenticated, email missing, or key missing');
          }
          if (!passcode) {
            await this.logAction(c, 'registerKey', 400);
            return this.sendError(c, 400, 'Passcode is required');
          }
          if (!Totp.validate({ secret: regKey.secret, passcode })) {
            await this.logAction(c, 'registerKey', 400);
            return this.sendError(c, 400, 'Invalid passcode');
          }
          await this.userService.setAuthenticatorSecret(user.user_id, regKey.secret);
          await this.logAction(c, 'registerKey', 200);
          return c.json({ message: 'Key registered successfully' }, 200);
        }

        case 'delete': {
          if (!user || !user.email) {
            await this.logAction(c, 'deleteKey', 400);
            return this.sendError(c, 400, 'User not authenticated or email missing');
          }
          await this.userService.setAuthenticatorSecret(user.user_id, null);
          await this.logAction(c, 'deleteKey', 200);
          return c.json({ message: 'Google Authenticator deleted successfully' }, 200);
        }

        default:
          return this.sendError(c, 404, 'Unknown action');
      }
    } catch (error) {
      await this.logAction(c, action, 500, { error });
      return this.sendError(c, 500, `Error in ${action}`, error);
    }
  }
}
