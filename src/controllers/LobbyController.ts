import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost } from "inversify-express-utils";
import { ILobbyService } from '../services/LobbyService';
import {
    lobbyIdParamSchema,
    userIdParamSchema,
    userIdBodySchema,
    createLobbyBodySchema,
} from '../validators/LobbyValidator';
import { ValidationError } from 'yup';
import { v4 } from 'uuid';

@controller("/api/lobbies")
export class LobbyController {
    constructor(
        @inject("LobbyService") private lobbyService: ILobbyService,
    ) {}

    @httpGet("/:lobbyId")
    public async getLobby(req: Request, res: Response) {
        try {
            await lobbyIdParamSchema.validate(req.params);
            const lobbyId = req.params.lobbyId;
            const lobby = await this.lobbyService.getLobby(lobbyId);
            if (!lobby) {
                return res.status(404).send({ message: "Lobby not found" });
            }
            res.send(lobby);
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching lobby", error: message });
        }
    }

    @httpPost("/:lobbyId/join")
    public async joinLobby(req: Request, res: Response) {
        try {
            await lobbyIdParamSchema.validate(req.params);
            await userIdBodySchema.validate(req.body);
            const lobbyId = req.params.lobbyId;
            const { userId } = req.body;
            await this.lobbyService.joinLobby(lobbyId, userId);
            res.status(200).send({ message: "Joined lobby" });
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error joining lobby", error: message });
        }
    }

    @httpPost("/:lobbyId/leave")
    public async leaveLobby(req: Request, res: Response) {
        try {
            await lobbyIdParamSchema.validate(req.params);
            await userIdBodySchema.validate(req.body);
            const lobbyId = req.params.lobbyId;
            const { userId } = req.body;
            await this.lobbyService.leaveLobby(lobbyId, userId);
            res.status(200).send({ message: "Left lobby" });
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error leaving lobby", error: message });
        }
    }

    @httpGet("/user/:userId")
    public async getUserLobby(req: Request, res: Response) {
        try {
            await userIdParamSchema.validate(req.params);
            const { userId } = req.params;
            const lobby = await this.lobbyService.getUserLobby(userId);
            if (!lobby) {
                return res.status(404).send({ message: "User is not in any lobby" });
            }
            res.send(lobby);
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user lobby", error: message });
        }
    }

    @httpPost("/")
    public async createLobby(req: Request, res: Response) {
        try {
            await createLobbyBodySchema.validate(req.body);
            const lobbyId = v4(); // Generate a new UUID for the lobbyId
            const { users } = req.body;
            await this.lobbyService.createLobby(lobbyId, users);
            res.status(201).send({ message: "Lobby created" });
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating lobby", error: message });
        }
    }
}