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
import { describe } from '../decorators/describe';

@controller("/lobbies")
export class LobbyController {
    constructor(
        @inject("LobbyService") private lobbyService: ILobbyService,
    ) {}

    @describe({
        endpoint: "/lobbies/:lobbyId",
        method: "GET",
        description: "Get a lobby by lobbyId",
        params: { lobbyId: "The id of the lobby" },
        responseType: "object{lobbyId: string, users: array[string]}",
        example: "GET /api/lobbies/123"
    })
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

    @describe({
        endpoint: "/lobbies/:lobbyId/join",
        method: "POST",
        description: "Join a lobby",
        params: { lobbyId: "The id of the lobby" },
        body: { userId: "The id of the user joining the lobby" },
        responseType: "object{message: string}",
        example: "POST /api/lobbies/123/join {\"userId\": \"user_1\"}"
    })
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

    @describe({
        endpoint: "/lobbies/:lobbyId/leave",
        method: "POST",
        description: "Leave a lobby",
        params: { lobbyId: "The id of the lobby" },
        body: { userId: "The id of the user leaving the lobby" },
        responseType: "object{message: string}",
        example: "POST /api/lobbies/123/leave {\"userId\": \"user_1\"}"
    })
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

    @describe({
        endpoint: "/lobbies/user/:userId",
        method: "GET",
        description: "Get the lobby a user is in",
        params: { userId: "The id of the user" },
        responseType: "object{lobbyId: string, users: array[string]}",
        example: "GET /api/lobbies/user/123"
    })
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

    @describe({
        endpoint: "/lobbies",
        method: "POST",
        description: "Create a new lobby",
        body: { users: "Array of user IDs to add to the lobby" },
        responseType: "object{message: string}",
        example: "POST /api/lobbies {\"users\": [\"user_1\", \"user_2\"]}"
    })
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