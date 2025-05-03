import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut, httpDelete } from "inversify-express-utils";
import { IGameService } from '../services/GameService';
import { ValidationError } from 'yup';
import { gameIdParamSchema, createGameBodySchema, updateGameBodySchema } from '../validators/GameValidator';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { v4 } from 'uuid';

@controller("/games")
export class GameController {
    constructor(
        @inject("GameService") private gameService: IGameService,
    ) {}

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

    @httpPut("/:gameId")
    public async updateGame(req: Request, res: Response) {
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

    @httpDelete("/:gameId")
    public async deleteGame(req: Request, res: Response) {
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
}
