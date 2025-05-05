import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut, httpDelete } from "inversify-express-utils";
import { IGameService } from '../services/GameService';
import { ValidationError } from 'yup';
import { gameIdParamSchema, createGameBodySchema, updateGameBodySchema } from '../validators/GameValidator';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { v4 } from 'uuid';
import { describe } from '../decorators/describe';

@controller("/games")
export class GameController {
    constructor(
        @inject("GameService") private gameService: IGameService,
    ) {}

    // Publique : liste tous les jeux
    @describe({
        endpoint: "/games",
        method: "GET",
        description: "List all games",
        responseType: "array[object{gameId: string, name: string, description: string, price: number, owner_id: string, showInStore: boolean, owners: array[string]}]",
        example: "GET /api/games"
    })
    @httpGet("/")
    public async listGames(req: Request, res: Response) {
        try {
            const games = await this.gameService.listGames();
            res.send(games);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error listing games", error: message });
        }
    }

    // Publique : détail d'un jeu
    @describe({
        endpoint: "/games/:gameId",
        method: "GET",
        description: "Get a game by gameId",
        params: { gameId: "The id of the game" },
        responseType: "object{gameId: string, name: string, description: string, price: number, owner_id: string, showInStore: boolean, owners: array[string]}",
        example: "GET /api/games/123"
    })
    @httpGet("/:gameId")
    public async getGame(req: Request, res: Response) {
        try {
            await gameIdParamSchema.validate(req.params);
            const { gameId } = req.params;
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                return res.status(404).send({ message: "Game not found" });
            }
            res.send(game);
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching game", error: message });
        }
    }

    // Interne : création d'un jeu (authentifié)
    @httpPost("/", LoggedCheck.middleware)
    public async createGame(req: AuthenticatedRequest, res: Response) {
        try {
            await createGameBodySchema.validate(req.body);

            const { name, description, price, showInStore } = req.body;
            const gameId = v4(); // Generate a new UUID for the gameId
            const ownerId = req.user.user_id; // Assuming req.user is set by the LoggedCheck middleware

            await this.gameService.createGame({
                gameId,
                name,
                description,
                price,
                ownerId,
                showInStore
            });
            res.status(201).send({ message: "Game created" });
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating game", error: message });
        }
    }

    @httpGet("/list", LoggedCheck.middleware)
    public async getUserGames(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user.user_id; // Assuming req.user is set by the LoggedCheck middleware
            const games = await this.gameService.getUserGames(userId);
            res.send(games);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user games", error: message });
        }
    }

    // Interne : update d'un jeu (authentifié)
    @httpPut("/:gameId", LoggedCheck.middleware)
    public async updateGame(req: AuthenticatedRequest, res: Response) {
        try {
            await gameIdParamSchema.validate(req.params);
            await updateGameBodySchema.validate(req.body);
            const { gameId } = req.params;
            await this.gameService.updateGame(gameId, req.body);
            res.status(200).send({ message: "Game updated" });
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error updating game", error: message });
        }
    }

    // Interne : suppression d'un jeu (authentifié)
    @httpDelete("/:gameId", LoggedCheck.middleware)
    public async deleteGame(req: AuthenticatedRequest, res: Response) {
        try {
            await gameIdParamSchema.validate(req.params);
            const { gameId } = req.params;
            await this.gameService.deleteGame(gameId);
            res.status(200).send({ message: "Game deleted" });
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error deleting game", error: message });
        }
    }

    // Interne : ajouter un owner secondaire
    @httpPost("/:gameId/owners", LoggedCheck.middleware)
    public async addOwner(req: AuthenticatedRequest, res: Response) {
        const { gameId } = req.params;
        const { ownerId } = req.body;
        if (!ownerId) return res.status(400).send({ message: "Missing ownerId" });
        try {
            await this.gameService.addOwner(gameId, ownerId);
            res.status(200).send({ message: "Owner added" });
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error adding owner", error: message });
        }
    }

    // Interne : retirer un owner secondaire
    @httpDelete("/:gameId/owners/:ownerId", LoggedCheck.middleware)
    public async removeOwner(req: AuthenticatedRequest, res: Response) {
        const { gameId, ownerId } = req.params;
        try {
            await this.gameService.removeOwner(gameId, ownerId);
            res.status(200).send({ message: "Owner removed" });
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error removing owner", error: message });
        }
    }
}
