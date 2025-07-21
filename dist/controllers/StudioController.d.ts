import { Request, Response } from "express";
import { IStudioService } from "../services/StudioService";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
export declare class StudioController {
    private studioService;
    constructor(studioService: IStudioService);
    /**
     * GET /studios/:studioId
     * Récupère un studio par son user_id
     */
    getStudio(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /studios
     * Crée un studio
     * Body: { userId, adminId, studioName, adminUsername, adminEmail, adminPassword }
     */
    createStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /studios/:studioId/properties
     * Met à jour les propriétés d'un studio (admin_id, users)
     * Body: { adminId, users: User[] }
     */
    setStudioProperties(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /studios/:studioId/add-user
     * Ajoute un utilisateur à un studio
     * Body: { user: User }
     */
    addUserToStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /studios/:studioId/remove-user
     * Retire un utilisateur d'un studio
     * Body: { userId: string }
     */
    removeUserFromStudio(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
