import { controller, httpGet, httpPost } from "inversify-express-utils";
import { inject } from "inversify";
import { Request, Response } from "express";
import { IStudioService } from "../services/StudioService";
import { User } from "../interfaces/User";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";

@controller("/studios")
export class StudioController {
    constructor(
        @inject("StudioService") private studioService: IStudioService
    ) { }

    /**
     * GET /studios/:studioId
     * Récupère un studio par son user_id
     */
    @httpGet(":studioId")
    async getStudio(req: Request, res: Response) {
        const { studioId } = req.params;
        const studio = await this.studioService.getStudio(studioId);
        if (!studio) {
            return res.status(404).send({ message: "Studio not found" });
        }
        res.send(studio);
    }

    /**
     * POST /studios
     * Crée un studio
     * Body: { userId, adminId, studioName, adminUsername, adminEmail, adminPassword }
     */
    @httpPost("/", LoggedCheck.middleware)
    async createStudio(req: AuthenticatedRequest, res: Response) {
        if(req.user.isStudio) {
            return res.status(403).send({ message: "A studio can't create another studio" });
        }
        const { studioName } = req.body;
        if (!studioName) {
            return res.status(400).send({ message: "Missing required fields" });
        }
        try {
            await this.studioService.createStudio(studioName, req.user.user_id);
            res.status(201).send({ message: "Studio created" });
        } catch (error) {
            res.status(500).send({ message: "Error creating studio", error: (error as Error).message });
        }
    }

    /**
     * POST /studios/:studioId/properties
     * Met à jour les propriétés d'un studio (admin_id, users)
     * Body: { adminId, users: User[] }
     */
    @httpPost("/:studioId/properties")
    async setStudioProperties(req: Request, res: Response) {
        const { studioId } = req.params;
        const { adminId, users } = req.body;
        if (!adminId || !Array.isArray(users)) {
            return res.status(400).send({ message: "Missing adminId or users" });
        }
        try {
            await this.studioService.setStudioProperties(studioId, adminId, users as User[]);
            res.send({ message: "Studio properties updated" });
        } catch (error) {
            res.status(500).send({ message: "Error updating studio properties", error: (error as Error).message });
        }
    }

    /**
     * POST /studios/:studioId/add-user
     * Ajoute un utilisateur à un studio
     * Body: { user: User }
     */
    @httpPost("/:studioId/add-user", LoggedCheck.middleware)
    async addUserToStudio(req: AuthenticatedRequest, res: Response) {
        const { studioId } = req.params;
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).send({ message: "Missing userId" });
        }
        const user = await this.studioService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        try {
            await this.studioService.addUserToStudio(studioId, user);
            res.send({ message: "User added to studio" });
        } catch (error) {
            res.status(500).send({ message: "Error adding user to studio", error: (error as Error).message });
        }
    }

    /**
     * POST /studios/:studioId/remove-user
     * Retire un utilisateur d'un studio
     * Body: { userId: string }
     */
    @httpPost("/:studioId/remove-user", LoggedCheck.middleware)
    async removeUserFromStudio(req: AuthenticatedRequest, res: Response) {
        const { studioId } = req.params;
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).send({ message: "Missing userId" });
        }
        const studio = await this.studioService.getStudio(studioId);
        if (!studio) {
            return res.status(404).send({ message: "Studio not found" });
        }
        if (studio.admin_id === req.originalUser?.user_id && studio.admin_id === userId) {
            return res.status(403).send({ message: "Cannot remove the studio admin" });
        }
        if (req.originalUser?.user_id !== studio.admin_id) {
            return res.status(403).send({ message: "Only the studio admin can remove users" });
        }
        try {
            await this.studioService.removeUserFromStudio(studioId, userId);
            res.send({ message: "User removed from studio" });
        } catch (error) {
            res.status(500).send({ message: "Error removing user from studio", error: (error as Error).message });
        }
    }
}
