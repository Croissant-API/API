import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut, httpDelete } from "inversify-express-utils";
import { IGameService } from '../services/GameService';
import { ValidationError } from 'yup';
import { gameIdParamSchema, createGameBodySchema, updateGameBodySchema } from '../validators/GameValidator';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { v4 } from 'uuid';
import { describe } from '../decorators/describe';
import { IUserService } from '../services/UserService';

@controller("/games")
export class Games {
    constructor(
        @inject("GameService") private gameService: IGameService,
        @inject("UserService") private userService: IUserService,
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

    @httpGet("/list/@me", LoggedCheck.middleware)
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

    @describe({
        endpoint: "/games/list/:userId",
        method: "GET",
        description: "List all games owned by a specific user",
        params: { userId: "The id of the user" },
        responseType: "array[object{gameId: string, name: string, description: string, price: number, owner_id: string, showInStore: boolean, owners: array[string]}]",
        example: "GET /api/games/list/123"
    })
    @httpGet("/list/:userId")
    public async getGamesByUserId(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const games = await this.gameService.getUserGames(userId);
            res.send(games);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user games", error: message });
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

    // Interne : acheter un jeu (buy)
    @httpPost("/:gameId/buy", LoggedCheck.middleware)
    public async buyGame(req: AuthenticatedRequest, res: Response) {
        const { gameId } = req.params;
        const userId = req.user.user_id;
        try {
            // L'utilisateur ne peut pas revendre le jeu, donc on ne retire jamais un owner
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                return res.status(404).send({ message: "Game not found" });
            }
            if (game.ownerId === userId) {
                await this.gameService.addOwner(gameId, userId);
                res.status(200).send({ message: "Game obtained" });
            }
            else {
                const user = await this.userService.getUser(userId);
                if (!user) {
                    return res.status(404).send({ message: "User not found" });
                }
                if (user.balance < game.price) {
                    return res.status(400).send({ message: "Not enough balance" });
                }
                await this.userService.updateUserBalance(userId, user.balance - game.price);
                await this.gameService.addOwner(gameId, userId);
                res.status(200).send({ message: "Game purchased" });
            }
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error purchasing game", error: message });
        }
    }
}
