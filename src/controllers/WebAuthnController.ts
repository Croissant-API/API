import { WebAuthnCredential } from '@simplewebauthn/server/script/types';
import type { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpPost } from '../hono-inversify';
import { getAuthenticationOptions, getRegistrationOptions, verifyRegistration } from '../lib/webauthnService';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
import { genKey } from '../utils/GenKey';
import { generateUserJwt } from '../utils/Jwt';

@controller('/webauthn')
export class WebAuthn {
  constructor(
    @inject('UserService') private userService: IUserService,
    @inject('LogService') private logService: ILogService
  ) {}

  private async createLog(req: Request, action: string, tableName?: string, statusCode?: number, userId?: string, metadata?: object) {
    try {
      const requestBody = { ...req.body };
      if (metadata) requestBody.metadata = metadata;
      await this.logService.createLog({
        ip_address: (req.headers['x-real-ip'] as string) || (req.socket.remoteAddress as string),
        table_name: tableName,
        controller: `WebAuthnController.${action}`,
        original_path: req.originalUrl,
        http_method: req.method,
        request_body: requestBody,
        user_id: userId,
        status_code: statusCode,
      });
    } catch (error) {
      console.error('Error creating log:', error);
    }
  }

  @httpPost('/register/options')
  async getRegistrationOptions(req: Request, res: Response) {
    const userId = req.body.userId as string;
    if (!userId) {
      await this.createLog(req, 'getRegistrationOptions', 'users', 400);
      return res.status(400).json({ message: 'User ID is required' });
    }
    try {
      const options = await getRegistrationOptions(userId);

      const challengeBase64 = Buffer.from(options.challenge).toString('base64');
      await this.userService.updateWebauthnChallenge(userId, challengeBase64);
      options.challenge = challengeBase64;
      options.user.id = Buffer.from(options.user.id).toString('base64');
      await this.createLog(req, 'getRegistrationOptions', 'users', 200, userId);
      res.status(200).json(options);
    } catch (e: unknown) {
      await this.createLog(req, 'getRegistrationOptions', 'users', 500, undefined, { error: (e as Error).message });
      res.status(500).json({ message: 'Error generating registration options' });
    }
  }

  @httpPost('/register/verify')
  async verifyRegistration(req: Request, res: Response) {
    const { credential, userId } = req.body;
    if (!credential) {
      await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
      return res.status(400).json({ message: 'Credential is required' });
    }
    try {
      const user = await this.userService.getUser(userId);
      const expectedChallenge = user?.webauthn_challenge;
      if (!expectedChallenge) {
        await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
        return res.status(400).json({ message: 'No challenge found' });
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
        await this.createLog(req, 'verifyRegistration', 'users', 200, userId);
        return res.status(200).json({ message: 'Registration successful' });
      } else {
        await this.createLog(req, 'verifyRegistration', 'users', 400, userId);
        return res.status(400).json({ message: 'Registration verification failed' });
      }
    } catch (error: unknown) {
      await this.createLog(req, 'verifyRegistration', 'users', 500, userId, {
        error: (error as Error).message,
      });
      res.status(500).json({ message: 'Error verifying registration' });
    }
  }

  @httpPost('/authenticate/options')
  async getAuthenticationOptionsHandler(req: Request, res: Response) {
    const userId = req.body.userId as string;
    let credentials: WebAuthnCredential[] = [];
    try {
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
      await this.createLog(req, 'getAuthenticationOptionsHandler', 'users', 200, userId);
      res.status(200).json(options);
    } catch (error: unknown) {
      console.error('Error generating authentication options:', error);
      await this.createLog(req, 'getAuthenticationOptionsHandler', 'users', 500, userId, { error: (error as Error).message });
      res.status(500).json({ message: 'Error generating authentication options' });
    }
  }

  @httpPost('/authenticate/verify')
  async verifyAuthenticationHandler(req: Request, res: Response) {
    const { credential, userId } = req.body;
    if (!credential) {
      await this.createLog(req, 'verifyAuthenticationHandler', 'users', 400, userId);
      return res.status(400).json({ message: 'Credential is required' });
    }
    try {
      credential.id = credential.id.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      let user;
      if (userId) {
        user = await this.userService.getUser(userId);
      } else if (credential.id) {
        user = await this.userService.getUserByCredentialId(credential.id);
      }
      if (!user) {
        await this.createLog(req, 'verifyAuthenticationHandler', 'users', 404, userId);
        return res.status(404).json({ message: 'User not found' });
      }

      const apiKey = genKey(user.user_id);
      const jwtToken = generateUserJwt(user, apiKey);

      await this.createLog(req, 'verifyAuthenticationHandler', 'users', 200, user.user_id);
      res.status(200).json({ message: 'Authentication successful', token: jwtToken });
    } catch (error: unknown) {
      await this.createLog(req, 'verifyAuthenticationHandler', 'users', 500, userId, { error: (error as Error).message });
      res.status(500).json({ message: 'Error verifying authentication' });
    }
  }
}
