/* eslint-disable @typescript-eslint/no-explicit-any */
import { WebAuthnCredential } from '@simplewebauthn/server/script/types';
import { Context } from 'hono';
import { inject, injectable } from 'inversify';
import { controller, httpPost } from 'inversify-express-utils';
import { getAuthenticationOptions, getRegistrationOptions, verifyRegistration } from '../lib/webauthnService';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
import { genKey } from '../utils/GenKey';
import { generateUserJwt } from '../utils/Jwt';

@injectable()
@controller('/webauthn')
export class WebAuthn {
  constructor(
    @inject('UserService') private userService: IUserService,
    @inject('LogService') private logService: ILogService
  ) {}

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
        controller: `WebAuthnController.${action}`,
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

  @httpPost('/register/options')
  async getRegistrationOptions(c: Context) {
    try {
      const body = await c.req.json();
      const { userId } = body;
      
      if (!userId) {
        await this.createLog(c, 'getRegistrationOptions', 'users', 400, undefined, undefined, body);
        return this.sendError(c, 400, 'User ID is required');
      }
      
      const options = await getRegistrationOptions(userId);

      const challengeBase64 = Buffer.from(options.challenge).toString('base64');
      await this.userService.updateWebauthnChallenge(userId, challengeBase64);
      options.challenge = challengeBase64;
      options.user.id = Buffer.from(options.user.id).toString('base64');
      
      await this.createLog(c, 'getRegistrationOptions', 'users', 200, userId, undefined, body);
      return c.json(options, 200);
    } catch (e: unknown) {
      console.error('Error generating registration options:', e);
      await this.createLog(c, 'getRegistrationOptions', 'users', 500, undefined, { error: (e as Error).message });
      return this.sendError(c, 500, 'Error generating registration options');
    }
  }

  @httpPost('/register/verify')
  async verifyRegistration(c: Context) {
    try {
      const body = await c.req.json();
      const { credential, userId } = body;
      
      if (!credential) {
        await this.createLog(c, 'verifyRegistration', 'users', 400, userId, undefined, body);
        return this.sendError(c, 400, 'Credential is required');
      }
      
      const user = await this.userService.getUser(userId);
      const expectedChallenge = user?.webauthn_challenge;
      if (!expectedChallenge) {
        await this.createLog(c, 'verifyRegistration', 'users', 400, userId, undefined, body);
        return this.sendError(c, 400, 'No challenge found');
      }

      function base64ToBase64url(str: string) {
        return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
      const expectedChallengeBase64url = base64ToBase64url(expectedChallenge);

      const verification = await verifyRegistration({ credential }, expectedChallengeBase64url);
      if (verification) {
        await this.userService.updateWebauthnChallenge(credential.id, null);
        await this.userService.addWebauthnCredential(userId, {
          id: credential.id,
          name: credential.name || 'Default Name',
          created_at: new Date(),
        });
        await this.createLog(c, 'verifyRegistration', 'users', 200, userId, undefined, body);
        return c.json({ message: 'Registration successful' }, 200);
      } else {
        await this.createLog(c, 'verifyRegistration', 'users', 400, userId, undefined, body);
        return this.sendError(c, 400, 'Registration verification failed');
      }
    } catch (error: unknown) {
      console.error('Error verifying registration:', error);
      await this.createLog(c, 'verifyRegistration', 'users', 500, undefined, { error: (error as Error).message });
      return this.sendError(c, 500, 'Error verifying registration');
    }
  }

  @httpPost('/authenticate/options')
  async getAuthenticationOptionsHandler(c: Context) {
    try {
      const body = await c.req.json();
      const { userId } = body;
      
      let credentials: WebAuthnCredential[] = [];
      
      if (userId) {
        const user = await this.userService.getUser(userId);
        credentials = JSON.parse(user?.webauthn_credentials || '[]');
      } else {
        credentials = [];
      }
      
      const options = await getAuthenticationOptions(credentials);
      const challengeBase64 = Buffer.from(options.challenge).toString('base64');
      
      if (userId) {
        await this.userService.updateWebauthnChallenge(userId, challengeBase64);
      }
      
      options.challenge = challengeBase64;
      await this.createLog(c, 'getAuthenticationOptionsHandler', 'users', 200, userId, undefined, body);
      return c.json(options, 200);
    } catch (error: unknown) {
      console.error('Error generating authentication options:', error);
      await this.createLog(c, 'getAuthenticationOptionsHandler', 'users', 500, undefined, { error: (error as Error).message });
      return this.sendError(c, 500, 'Error generating authentication options');
    }
  }

  @httpPost('/authenticate/verify')
  async verifyAuthenticationHandler(c: Context) {
    try {
      const body = await c.req.json();
      const { credential, userId } = body;
      
      if (!credential) {
        await this.createLog(c, 'verifyAuthenticationHandler', 'users', 400, userId, undefined, body);
        return this.sendError(c, 400, 'Credential is required');
      }
      
      credential.id = credential.id.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      let user;
      if (userId) {
        user = await this.userService.getUser(userId);
      } else if (credential.id) {
        user = await this.userService.getUserByCredentialId(credential.id);
      }
      
      if (!user) {
        await this.createLog(c, 'verifyAuthenticationHandler', 'users', 404, userId, undefined, body);
        return this.sendError(c, 404, 'User not found');
      }

      const apiKey = genKey(user.user_id);
      const jwtToken = generateUserJwt(user, apiKey);

      await this.createLog(c, 'verifyAuthenticationHandler', 'users', 200, user.user_id, undefined, body);
      return c.json({ message: 'Authentication successful', token: jwtToken }, 200);
    } catch (error: unknown) {
      console.error('Error verifying authentication:', error);
      await this.createLog(c, 'verifyAuthenticationHandler', 'users', 500, undefined, { error: (error as Error).message });
      return this.sendError(c, 500, 'Error verifying authentication');
    }
  }
}
