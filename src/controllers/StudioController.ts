import { controller, httpGet, httpPost } from "inversify-express-utils";
import { inject } from "inversify";
import { Request, Response } from "express";
import { IStudioService } from "../services/StudioService";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { describe } from "decorators/describe";

@controller("/studios")
export class Studios {
    constructor(
        @inject("StudioService") private studioService: IStudioService
    ) { }

    @describe({
        endpoint: "/studios/:studioId",
        method: "GET",
        description: "Get a studio by studioId",
        params: { studioId: "The ID of the studio to retrieve" },
        responseType: { studio_id: "string", name: "string", admin_id: "string", users: "User[]" },
        exampleResponse: {
            studio_id: "studio123",
            name: "My Studio",
            admin_id: "user1",
            users: [
                { user_id: "user1", username: "User One", verified: true, isStudio: false, admin: false },
                { user_id: "user2", username: "User Two", verified: true, isStudio: false, admin: false }
            ]
        },
    })
    @httpGet(":studioId")
    async getStudio(req: Request, res: Response) {
        const { studioId } = req.params;
        const studio = await this.studioService.getStudio(studioId);
        if (!studio) {
            return res.status(404).send({ message: "Studio not found" });
        }
        res.send(studio);
    }

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
