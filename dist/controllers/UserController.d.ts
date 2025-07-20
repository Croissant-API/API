import { Request, Response } from 'express';
import { IUserService } from '../services/UserService';
import { AuthenticatedRequest } from '../middlewares/LoggedCheck';
import { SteamOAuthService } from '../services/SteamOAuthService';
export declare class Users {
    private userService;
    private steamOAuthService;
    /**
     * Connexion via OAuth (Google/Discord)
     * Body attendu : { email, provider, providerId, username? }
     */
    loginOAuth(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    constructor(userService: IUserService, steamOAuthService: SteamOAuthService);
    /**
     * Redirige l'utilisateur vers Steam pour l'authentification OpenID
     * GET /users/steam-redirect
     */
    steamRedirect(req: Request, res: Response): Promise<void>;
    /**
     * Associe le compte Steam à l'utilisateur connecté
     * GET /users/steam-associate (callback Steam OpenID)
     * Query params: OpenID response
     * Requires authentication
     */
    steamAssociate(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * GET /users/getUserBySteamId?steamId=xxx
     * Récupère un utilisateur par son Steam ID
     */
    getUserBySteamId(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getMe(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    searchUsers(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    adminSearchUsers(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    disableAccount(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    reenableAccount(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    adminGetUser(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    checkVerificationKey(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getUser(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    register(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    login(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    changePassword(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    transferCredits(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
