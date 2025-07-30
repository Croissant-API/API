import { Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  httpPost,
  httpPut,
} from "inversify-express-utils";
import { IGameService } from "../services/GameService";
import { ValidationError } from "yup";
import {
  gameIdParamSchema,
  createGameBodySchema,
  updateGameBodySchema,
} from "../validators/GameValidator";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { v4 } from "uuid";
import { describe } from "../decorators/describe";
import { IUserService } from "../services/UserService";
import { Schema } from "yup";

// --- UTILS ---
const gameResponseFields = {
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
};

function handleError(res: Response, error: unknown, message: string, status = 500) {
  const msg = error instanceof Error ? error.message : String(error);
  res.status(status).send({ message, error: msg });
}

async function validateOr400(schema: Schema<unknown>, data: unknown, res: Response) {
  try {
    await schema.validate(data);
    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).send({ message: "Validation failed", errors: error.errors });
      return false;
    }
    throw error;
  }
}

@controller("/games")
export class Games {
  constructor(
    @inject("GameService") private gameService: IGameService,
    @inject("UserService") private userService: IUserService
  ) { }

  // --- LISTING & SEARCH ---

  @describe({
    endpoint: "/games",
    method: "GET",
    description: "List all games visible in the store.",
    responseType: [gameResponseFields],
    example: "GET /api/games",
  })
  @httpGet("/")
  public async listGames(req: Request, res: Response) {
    try {
      const games = await this.gameService.getStoreGames();
      res.send(games);
    } catch (error) {
      handleError(res, error, "Error listing games");
    }
  }

  @describe({
    endpoint: "/games/search",
    method: "GET",
    description: "Search for games by name, genre, or description.",
    query: { q: "The search query" },
    responseType: [gameResponseFields],
    example: "GET /api/games/search?q=Minecraft",
  })
  @httpGet("/search")
  public async searchGames(req: Request, res: Response) {
    const query = (req.query.q as string)?.trim();
    if (!query) return res.status(400).send({ message: "Missing search query" });
    try {
      const games = await this.gameService.searchGames(query);
      res.send(games);
    } catch (error) {
      handleError(res, error, "Error searching games");
    }
  
  }

  @describe({
    endpoint: "/games/@mine",
    method: "GET",
    description: "Get all games created by the authenticated user.",
    responseType: [{ ...gameResponseFields, download_link: "string" }],
    example: "GET /api/games/@mine",
    requiresAuth: true,
  })
  @httpGet("/@mine", LoggedCheck.middleware)
  public async getMyCreatedGames(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.user_id;
      const games = await this.gameService.getMyCreatedGames(userId);
      res.send(games);
    } catch (error) {
      handleError(res, error, "Error fetching your created games");
    }
  }

  @describe({
    endpoint: "/games/list/@me",
    method: "GET",
    description:
      'Get all games owned by the authenticated user. Requires authentication via header "Authorization: Bearer <token>".',
    responseType: [{ ...gameResponseFields, download_link: "string" }],
    example: "GET /api/games/list/@me",
    requiresAuth: true,
  })
  @httpGet("/list/@me", LoggedCheck.middleware)
  public async getUserGames(req: AuthenticatedRequest, res: Response) {
    try {
      const games = await this.gameService.getUserOwnedGames(req.user.user_id);
      res.send(games);
    } catch (error) {
      handleError(res, error, "Error fetching user games");
    }
  }

  @describe({
    endpoint: "/games/:gameId",
    method: "GET",
    description: "Get a game by gameId.",
    params: { gameId: "The id of the game" },
    responseType: gameResponseFields,
    example: "GET /api/games/123",
  })
  @httpGet(":gameId")
  public async getGame(req: Request, res: Response) {
    if (!(await validateOr400(gameIdParamSchema, req.params, res))) return;
    try {
      const { gameId } = req.params;
      // Utilise la méthode publique qui exclut automatiquement download_link
      const game = await this.gameService.getGameForPublic(gameId);
      if (!game) return res.status(404).send({ message: "Game not found" });
      res.send(game);
    } catch (error) {
      handleError(res, error, "Error fetching game");
    }
  }

  // Si on veut une route pour les propriétaires
  @httpGet(":gameId/details", LoggedCheck.middleware)
  public async getGameDetails(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(gameIdParamSchema, req.params, res))) return;
    try {
      const { gameId } = req.params;
      const userId = req.user.user_id;
      // Utilise la méthode propriétaire qui inclut download_link si autorisé
      const game = await this.gameService.getGameForOwner(gameId, userId);
      if (!game) return res.status(404).send({ message: "Game not found" });
      res.send(game);
    } catch (error) {
      handleError(res, error, "Error fetching game details");
    }
  }

  // --- CREATION & MODIFICATION ---
  @httpPost("/", LoggedCheck.middleware)
  public async createGame(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(createGameBodySchema, req.body, res))) return;
    try {
      const { name, description, price, download_link, showInStore, iconHash, splashHash, bannerHash, genre, release_date, developer, publisher, platforms, rating, website, trailer_link, multiplayer } = req.body;
      const gameId = v4();
      const ownerId = req.user.user_id;
      await this.gameService.createGame({
        gameId, name, description, price,
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
        multiplayer: multiplayer ?? false,
      });
      await this.gameService.addOwner(gameId, ownerId);
      res.status(201).send({ message: "Game created", game: await this.gameService.getGame(gameId) });
    } catch (error) {
      handleError(res, error, "Error creating game");
    }
  }
  @httpPut(":gameId", LoggedCheck.middleware)
  public async updateGame(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(gameIdParamSchema, req.params, res))) return;
    if (!(await validateOr400(updateGameBodySchema, req.body, res))) return;
    try {
      const game = await this.gameService.getGame(req.params.gameId);
      if (!game) return res.status(404).send({ message: "Game not found" });
      if (req.user.user_id !== game.owner_id) return res.status(403).send({ message: "You are not the owner of this game" });
      await this.gameService.updateGame(req.params.gameId, req.body);
      const updatedGame = await this.gameService.getGame(req.params.gameId);
      res.status(200).send(updatedGame);
    } catch (error) {
      handleError(res, error, "Error updating game");
    }
  }

  // --- ACHAT ---
  @httpPost(":gameId/buy", LoggedCheck.middleware)
  public async buyGame(req: AuthenticatedRequest, res: Response) {
    const { gameId } = req.params;
    const userId = req.user.user_id;
    try {
      const game = await this.gameService.getGame(gameId);
      if (!game) return res.status(404).send({ message: "Game not found" });
      const userGames = await this.gameService.getUserGames(userId);
      if (userGames.some(g => g.gameId === gameId)) return res.status(400).send({ message: "Game already owned" });
      if (game.owner_id === userId) {
        await this.gameService.addOwner(gameId, userId);
        return res.status(200).send({ message: "Game obtained" });
      }
      const user = await this.userService.getUser(userId);
      if (!user) return res.status(404).send({ message: "User not found" });
      if (user.balance < game.price) return res.status(400).send({ message: "Not enough balance" });
      await this.userService.updateUserBalance(userId, user.balance - game.price);
      const owner = await this.userService.getUser(game.owner_id);
      if (!owner) return res.status(404).send({ message: "Owner not found" });
      await this.userService.updateUserBalance(game.owner_id, owner.balance + game.price * 0.75);
      await this.gameService.addOwner(gameId, userId);
      res.status(200).send({ message: "Game purchased" });
    } catch (error) {
      handleError(res, error, "Error purchasing game");
    }
  }
  // --- PROPRIÉTÉ ---
  @httpPost("/transfer-ownership/:gameId", LoggedCheck.middleware)
  public async transferOwnership(req: AuthenticatedRequest, res: Response) {
    if(!req.user) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    const { gameId } = req.params;
    const { newOwnerId } = req.body;
    if (!gameId || !newOwnerId) {
      return res.status(400).send({ message: "Invalid input" });
    }
    try {
      const game = await this.gameService.getGame(gameId);
      if (!game) {
        return res.status(404).send({ message: "Game not found" });
      }
      if( game.owner_id !== req.user.user_id) {
        return res.status(403).send({ message: "You are not the owner of this game" });
      }
      const newOwner = await this.userService.getUser(newOwnerId);
      if (!newOwner) {
        return res.status(404).send({ message: "New owner not found" });
      }
      // Optionally, handle versioning: increment version or log transfer
      await this.gameService.transferOwnership(gameId, newOwnerId);

      // Fetch updated game with version if available
      const updatedGame = await this.gameService.getGame(gameId);

      res.status(200).send({
        message: "Ownership transferred",
        game: updatedGame
      });
    } catch (error) {
      handleError(res, error, "Error transferring ownership");
    }
  }

  @describe({
    endpoint: "/games/:gameId/transfer",
    method: "POST",
    description: "Transfer your copy of a game to another user",
    params: { gameId: "The id of the game" },
    body: { targetUserId: "The id of the recipient user" },
    responseType: { message: "string" },
    example: "POST /api/games/123/transfer { targetUserId: '456' }",
    requiresAuth: true,
  })
  @httpPost(":gameId/transfer", LoggedCheck.middleware)
  public async transferGame(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(gameIdParamSchema, req.params, res))) return;
    
    const { gameId } = req.params;
    const { targetUserId } = req.body;
    const fromUserId = req.user.user_id;

    if (!targetUserId) {
      return res.status(400).send({ message: "Target user ID is required" });
    }

    if (fromUserId === targetUserId) {
      return res.status(400).send({ message: "Cannot transfer game to yourself" });
    }

    try {
      // Vérifier que le destinataire existe
      const targetUser = await this.userService.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).send({ message: "Target user not found" });
      }

      // Vérifier si le transfert est possible
      const canTransfer = await this.gameService.canTransferGame(gameId, fromUserId, targetUserId);
      if (!canTransfer.canTransfer) {
        return res.status(400).send({ message: canTransfer.reason });
      }

      // Effectuer le transfert
      await this.gameService.transferGameCopy(gameId, fromUserId, targetUserId);

      res.status(200).send({ 
        message: `Game successfully transferred to ${targetUser.username}` 
      });
    } catch (error) {
      handleError(res, error, "Error transferring game");
    }
  }

  @describe({
    endpoint: "/games/:gameId/can-transfer",
    method: "GET",
    description: "Check if you can transfer your copy of a game to another user",
    params: { gameId: "The id of the game" },
    query: { targetUserId: "The id of the recipient user" },
    responseType: { canTransfer: "boolean", reason: "string" },
    example: "GET /api/games/123/can-transfer?targetUserId=456",
    requiresAuth: true,
  })
  @httpGet(":gameId/can-transfer", LoggedCheck.middleware)
  public async canTransferGame(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(gameIdParamSchema, req.params, res))) return;
    
    const { gameId } = req.params;
    const { targetUserId } = req.query;
    const fromUserId = req.user.user_id;

    if (!targetUserId) {
      return res.status(400).send({ message: "Target user ID is required" });
    }

    try {
      const result = await this.gameService.canTransferGame(gameId, fromUserId, targetUserId as string);
      res.send(result);
    } catch (error) {
      handleError(res, error, "Error checking transfer eligibility");
    }
  }
}
