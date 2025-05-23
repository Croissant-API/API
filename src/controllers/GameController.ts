import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut } from "inversify-express-utils";
import { IGameService } from '../services/GameService';
import { ValidationError } from 'yup';
import { gameIdParamSchema, createGameBodySchema, updateGameBodySchema } from '../validators/GameValidator';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { v4 } from 'uuid';
import { describe } from '../decorators/describe';
import { IUserService } from '../services/UserService';
import { Game } from '../interfaces/Game';

// Utility to filter game fields based on the user
function filterGame(game: Game, userId?: string) {
    return {
        gameId: game.gameId,
        name: game.name,
        description: game.description,
        price: game.price,
        owner_id: game.owner_id,
        showInStore: game.showInStore,
        iconHash: game.iconHash,
        splashHash: game.splashHash,
        bannerHash: game.bannerHash,
        genre: game.genre,
        release_date: game.release_date,
        developer: game.developer,
        publisher: game.publisher,
        platforms: game.platforms,
        rating: game.rating,
        website: game.website,
        trailer_link: game.trailer_link,
        multiplayer: game.multiplayer,
        ...(userId && game.owner_id === userId ? { download_link: game.download_link } : {}),
    };
}

@controller("/games")
export class Games {
    constructor(
        @inject("GameService") private gameService: IGameService,
        @inject("UserService") private userService: IUserService,
    ) {}

    @describe({
        endpoint: "/games",
        method: "GET",
        description: "List all games visible in the store.",
        responseType: [{
            gameId: "string",
            name: "string",
            description: "string",
            price: "number",
            owner_id: "string",
            showInStore: "boolean",
            iconHash: "string",
            splashHash: "string",
            bannerHash: "string",
            genre: "string",
            release_date: "string",
            developer: "string",
            publisher: "string",
            platforms: ["string"],
            rating: "number",
            website: "string",
            trailer_link: "string",
            multiplayer: "boolean"
        }],
        example: "GET /api/games"
    })
    @httpGet("/")
    public async listGames(req: Request, res: Response) {
        try {
            const games = await this.gameService.listGames();
            const filteredGames = games.filter(game => game.showInStore).map(game => filterGame(game));
            res.send(filteredGames);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error listing games", error: message });
        }
    }

    @describe({
        endpoint: "/games/@mine",
        method: "GET",
        description: "Get all games created by the authenticated user.",
        responseType: [{
            gameId: "string",
            name: "string",
            description: "string",
            price: "number",
            owner_id: "string",
            showInStore: "boolean",
            iconHash: "string",
            splashHash: "string",
            bannerHash: "string",
            genre: "string",
            release_date: "string",
            developer: "string",
            publisher: "string",
            platforms: ["string"],
            rating: "number",
            website: "string",
            trailer_link: "string",
            multiplayer: "boolean",
            download_link: "string"
        }],
        example: "GET /api/games/@mine",
        requiresAuth: true
    })
    @httpGet("/@mine", LoggedCheck.middleware)
    public async getMyCreatedGames(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user.user_id;
            const games = await this.gameService.listGames();
            const myGames = games.filter(game => game.owner_id === userId);
            const filteredGames = myGames.map(game => filterGame(game, userId));
            res.send(filteredGames);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching your created games", error: message });
        }
    }

    @describe({
        endpoint: "/games/list/@me",
        method: "GET",
        description: "Get all games owned by the authenticated user. Requires authentication via header \"Authorization: Bearer <token>\".",
        responseType: [{
            gameId: "string",
            name: "string",
            description: "string",
            price: "number",
            owner_id: "string",
            showInStore: "boolean",
            iconHash: "string",
            splashHash: "string",
            bannerHash: "string",
            genre: "string",
            release_date: "string",
            developer: "string",
            publisher: "string",
            platforms: ["string"],
            rating: "number",
            website: "string",
            trailer_link: "string",
            multiplayer: "boolean",
            download_link: "string"
        }],
        example: "GET /api/games/list/@me",
        requiresAuth: true
    })
    @httpGet("/list/@me", LoggedCheck.middleware)
    public async getUserGames(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user.user_id;
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
        description: "List all games owned by a specific user.",
        params: { userId: "The id of the user" },
        responseType: [{
            gameId: "string",
            name: "string",
            description: "string",
            price: "number",
            owner_id: "string",
            showInStore: "boolean",
            iconHash: "string",
            splashHash: "string",
            bannerHash: "string",
            genre: "string",
            release_date: "string",
            developer: "string",
            publisher: "string",
            platforms: ["string"],
            rating: "number",
            website: "string",
            trailer_link: "string",
            multiplayer: "boolean"
        }],
        example: "GET /api/games/list/123"
    })
    @httpGet("/list/:userId")
    public async getGamesByUserId(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const games = await this.gameService.getUserGames(userId);
            const filteredGames = games.map(game => filterGame(game, userId));
            res.send(filteredGames);
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching user games", error: message });
        }
    }

    @describe({
        endpoint: "/games/:gameId",
        method: "GET",
        description: "Get a game by gameId.",
        params: { gameId: "The id of the game" },
        responseType: {
            gameId: "string",
            name: "string",
            description: "string",
            price: "number",
            owner_id: "string",
            showInStore: "boolean",
            iconHash: "string",
            splashHash: "string",
            bannerHash: "string",
            genre: "string",
            release_date: "string",
            developer: "string",
            publisher: "string",
            platforms: ["string"],
            rating: "number",
            website: "string",
            trailer_link: "string",
            multiplayer: "boolean"
        },
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
            res.send(filterGame(game));
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
            const {
                name,
                description,
                price,
                download_link,
                showInStore,
                iconHash,
                splashHash,
                bannerHash,
                genre,
                release_date,
                developer,
                publisher,
                platforms,
                rating,
                website,
                trailer_link,
                multiplayer
            } = req.body;
            const gameId = v4();
            const ownerId = req.user.user_id;

            await this.gameService.createGame({
                gameId,
                name,
                description,
                price,
                download_link: download_link ?? null,
                showInStore: showInStore ?? false,
                owner_id: ownerId,
                iconHash: iconHash ?? null,
                splashHash: splashHash ?? null,
                bannerHash: bannerHash ?? null,
                genre: genre ?? null,
                release_date: release_date ?? null,
                developer: developer ?? null,
                publisher: publisher ?? null,
                platforms: platforms ?? null,
                rating: rating ?? 0,
                website: website ?? null,
                trailer_link: trailer_link ?? null,
                multiplayer: multiplayer ?? false
            });
            // Ajoute automatiquement le créateur comme propriétaire
            await this.gameService.addOwner(gameId, ownerId);

            const game = await this.gameService.getGame(gameId);
            res.status(201).send({message: "Game created", game: game});
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating game", error: message });
        }
    }

    @httpPut("/:gameId", LoggedCheck.middleware)
    public async updateGame(req: AuthenticatedRequest, res: Response) {
        try {
            await gameIdParamSchema.validate(req.params);
            await updateGameBodySchema.validate(req.body);
            const game = await this.gameService.getGame(req.params.gameId);
            if (!game) {
                return res.status(404).send({ message: "Game not found" });
            }
            if(req.user.user_id !== game.owner_id) {
                return res.status(403).send({ message: "You are not the owner of this game" });
            }
            const { gameId } = req.params;
            await this.gameService.updateGame(gameId, req.body);
            const updatedGame = await this.gameService.getGame(gameId) as Game; 
            res.status(200).send(filterGame(updatedGame, req.user.user_id));
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).send({ message: "Validation failed", errors: error.errors });
            }
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error updating game", error: message });
        }
    }

    @httpPost("/:gameId/buy", LoggedCheck.middleware)
    public async buyGame(req: AuthenticatedRequest, res: Response) {
        const { gameId } = req.params;
        const userId = req.user.user_id;
        try {
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                return res.status(404).send({ message: "Game not found" });
            }
            if (game.owner_id === userId) {
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
                const owner = await this.userService.getUser(game.owner_id);
                if (!owner) {
                    return res.status(404).send({ message: "Owner not found" });
                }
                await this.userService.updateUserBalance(game.owner_id, owner.balance + (game.price * 0.75));
                await this.gameService.addOwner(gameId, userId);
                res.status(200).send({ message: "Game purchased" });
            }
        } catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error purchasing game", error: message });
        }
    }
}
