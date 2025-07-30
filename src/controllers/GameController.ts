import { Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  httpPost,
  httpPut,
} from "inversify-express-utils";
import { IGameService } from "../services/GameService";
import { ILogService } from "../services/LogService";
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
    @inject("UserService") private userService: IUserService,
    @inject("LogService") private logService: ILogService
  ) { }

  // Helper pour créer des logs
  private async createLog(req: Request, controller: string, tableName?: string, statusCode?: number, userId?: string) {
    try {
      await this.logService.createLog({
        ip_address: req.headers["x-real-ip"] as string || req.socket.remoteAddress as string,
        table_name: tableName,
        controller: `GameController.${controller}`,
        original_path: req.originalUrl,
        http_method: req.method,
        request_body: req.body,
        user_id: userId,
        status_code: statusCode
      });
    } catch (error) {
      console.error('Error creating log:', error);
    }
  }

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
      await this.createLog(req, 'listGames', 'games', 200);
      res.send(games);
    } catch (error) {
      await this.createLog(req, 'listGames', 'games', 500);
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
    if (!query) {
      await this.createLog(req, 'searchGames', 'games', 400);
      return res.status(400).send({ message: "Missing search query" });
    }
    try {
      const games = await this.gameService.searchGames(query);
      await this.createLog(req, 'searchGames', 'games', 200);
      res.send(games);
    } catch (error) {
      await this.createLog(req, 'searchGames', 'games', 500);
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
      await this.createLog(req, 'getMyCreatedGames', 'games', 200, userId);
      res.send(games);
    } catch (error) {
      await this.createLog(req, 'getMyCreatedGames', 'games', 500, req.user?.user_id);
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
      await this.createLog(req, 'getUserGames', 'games', 200, req.user.user_id);
      res.send(games);
    } catch (error) {
      await this.createLog(req, 'getUserGames', 'games', 500, req.user?.user_id);
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
    if (!(await validateOr400(gameIdParamSchema, req.params, res))) {
      await this.createLog(req, 'getGame', 'games', 400);
      return;
    }
    try {
      const { gameId } = req.params;
      const game = await this.gameService.getGameForPublic(gameId);
      if (!game) {
        await this.createLog(req, 'getGame', 'games', 404);
        return res.status(404).send({ message: "Game not found" });
      }
      await this.createLog(req, 'getGame', 'games', 200);
      res.send(game);
    } catch (error) {
      await this.createLog(req, 'getGame', 'games', 500);
      handleError(res, error, "Error fetching game");
    }
  }

  @httpGet(":gameId/details", LoggedCheck.middleware)
  public async getGameDetails(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(gameIdParamSchema, req.params, res))) {
      await this.createLog(req, 'getGameDetails', 'games', 400, req.user?.user_id);
      return;
    }
    try {
      const { gameId } = req.params;
      const userId = req.user.user_id;
      const game = await this.gameService.getGameForOwner(gameId, userId);
      if (!game) {
        await this.createLog(req, 'getGameDetails', 'games', 404, userId);
        return res.status(404).send({ message: "Game not found" });
      }
      await this.createLog(req, 'getGameDetails', 'games', 200, userId);
      res.send(game);
    } catch (error) {
      await this.createLog(req, 'getGameDetails', 'games', 500, req.user?.user_id);
      handleError(res, error, "Error fetching game details");
    }
  }

  // --- CREATION & MODIFICATION ---
  @httpPost("/", LoggedCheck.middleware)
  public async createGame(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(createGameBodySchema, req.body, res))) {
      await this.createLog(req, 'createGame', 'games', 400, req.user?.user_id);
      return;
    }
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
      await this.createLog(req, 'createGame', 'games', 201, ownerId);
      res.status(201).send({ message: "Game created", game: await this.gameService.getGame(gameId) });
    } catch (error) {
      await this.createLog(req, 'createGame', 'games', 500, req.user?.user_id);
      handleError(res, error, "Error creating game");
    }
  }

  @httpPut(":gameId", LoggedCheck.middleware)
  public async updateGame(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(gameIdParamSchema, req.params, res))) {
      await this.createLog(req, 'updateGame', 'games', 400, req.user?.user_id);
      return;
    }
    if (!(await validateOr400(updateGameBodySchema, req.body, res))) {
      await this.createLog(req, 'updateGame', 'games', 400, req.user?.user_id);
      return;
    }
    try {
      const game = await this.gameService.getGame(req.params.gameId);
      if (!game) {
        await this.createLog(req, 'updateGame', 'games', 404, req.user?.user_id);
        return res.status(404).send({ message: "Game not found" });
      }
      if (req.user.user_id !== game.owner_id) {
        await this.createLog(req, 'updateGame', 'games', 403, req.user?.user_id);
        return res.status(403).send({ message: "You are not the owner of this game" });
      }
      await this.gameService.updateGame(req.params.gameId, req.body);
      const updatedGame = await this.gameService.getGame(req.params.gameId);
      await this.createLog(req, 'updateGame', 'games', 200, req.user.user_id);
      res.status(200).send(updatedGame);
    } catch (error) {
      await this.createLog(req, 'updateGame', 'games', 500, req.user?.user_id);
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
      if (!game) {
        await this.createLog(req, 'buyGame', 'games', 404, userId);
        return res.status(404).send({ message: "Game not found" });
      }
      const userGames = await this.gameService.getUserGames(userId);
      if (userGames.some(g => g.gameId === gameId)) {
        await this.createLog(req, 'buyGame', 'games', 400, userId);
        return res.status(400).send({ message: "Game already owned" });
      }
      if (game.owner_id === userId) {
        await this.gameService.addOwner(gameId, userId);
        await this.createLog(req, 'buyGame', 'games', 200, userId);
        return res.status(200).send({ message: "Game obtained" });
      }
      const user = await this.userService.getUser(userId);
      if (!user) {
        await this.createLog(req, 'buyGame', 'games', 404, userId);
        return res.status(404).send({ message: "User not found" });
      }
      if (user.balance < game.price) {
        await this.createLog(req, 'buyGame', 'games', 400, userId);
        return res.status(400).send({ message: "Not enough balance" });
      }
      await this.userService.updateUserBalance(userId, user.balance - game.price);
      const owner = await this.userService.getUser(game.owner_id);
      if (!owner) {
        await this.createLog(req, 'buyGame', 'games', 404, userId);
        return res.status(404).send({ message: "Owner not found" });
      }
      await this.userService.updateUserBalance(game.owner_id, owner.balance + game.price * 0.75);
      await this.gameService.addOwner(gameId, userId);
      await this.createLog(req, 'buyGame', 'games', 200, userId);
      res.status(200).send({ message: "Game purchased" });
    } catch (error) {
      await this.createLog(req, 'buyGame', 'games', 500, userId);
      handleError(res, error, "Error purchasing game");
    }
  }

  // --- PROPRIÉTÉ ---
  @httpPost("/transfer-ownership/:gameId", LoggedCheck.middleware)
  public async transferOwnership(req: AuthenticatedRequest, res: Response) {
    if(!req.user) {
      await this.createLog(req, 'transferOwnership', 'games', 401);
      return res.status(401).send({ message: "Unauthorized" });
    }
    const { gameId } = req.params;
    const { newOwnerId } = req.body;
    const userId = req.user.user_id;
    if (!gameId || !newOwnerId) {
      await this.createLog(req, 'transferOwnership', 'games', 400, userId);
      return res.status(400).send({ message: "Invalid input" });
    }
    try {
      const game = await this.gameService.getGame(gameId);
      if (!game) {
        await this.createLog(req, 'transferOwnership', 'games', 404, userId);
        return res.status(404).send({ message: "Game not found" });
      }
      if( game.owner_id !== userId) {
        await this.createLog(req, 'transferOwnership', 'games', 403, userId);
        return res.status(403).send({ message: "You are not the owner of this game" });
      }
      const newOwner = await this.userService.getUser(newOwnerId);
      if (!newOwner) {
        await this.createLog(req, 'transferOwnership', 'games', 404, userId);
        return res.status(404).send({ message: "New owner not found" });
      }
      await this.gameService.transferOwnership(gameId, newOwnerId);
      const updatedGame = await this.gameService.getGame(gameId);
      await this.createLog(req, 'transferOwnership', 'games', 200, userId);
      res.status(200).send({
        message: "Ownership transferred",
        game: updatedGame
      });
    } catch (error) {
      await this.createLog(req, 'transferOwnership', 'games', 500, userId);
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
    if (!(await validateOr400(gameIdParamSchema, req.params, res))) {
      await this.createLog(req, 'transferGame', 'games', 400, req.user?.user_id);
      return;
    }
    
    const { gameId } = req.params;
    const { targetUserId } = req.body;
    const fromUserId = req.user.user_id;

    if (!targetUserId) {
      await this.createLog(req, 'transferGame', 'games', 400, fromUserId);
      return res.status(400).send({ message: "Target user ID is required" });
    }

    if (fromUserId === targetUserId) {
      await this.createLog(req, 'transferGame', 'games', 400, fromUserId);
      return res.status(400).send({ message: "Cannot transfer game to yourself" });
    }

    try {
      const targetUser = await this.userService.getUser(targetUserId);
      if (!targetUser) {
        await this.createLog(req, 'transferGame', 'games', 404, fromUserId);
        return res.status(404).send({ message: "Target user not found" });
      }

      const canTransfer = await this.gameService.canTransferGame(gameId, fromUserId, targetUserId);
      if (!canTransfer.canTransfer) {
        await this.createLog(req, 'transferGame', 'games', 400, fromUserId);
        return res.status(400).send({ message: canTransfer.reason });
      }

      await this.gameService.transferGameCopy(gameId, fromUserId, targetUserId);
      await this.createLog(req, 'transferGame', 'games', 200, fromUserId);
      res.status(200).send({ 
        message: `Game successfully transferred to ${targetUser.username}` 
      });
    } catch (error) {
      await this.createLog(req, 'transferGame', 'games', 500, fromUserId);
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
    if (!(await validateOr400(gameIdParamSchema, req.params, res))) {
      await this.createLog(req, 'canTransferGame', 'games', 400, req.user?.user_id);
      return;
    }
    
    const { gameId } = req.params;
    const { targetUserId } = req.query;
    const fromUserId = req.user.user_id;

    if (!targetUserId) {
      await this.createLog(req, 'canTransferGame', 'games', 400, fromUserId);
      return res.status(400).send({ message: "Target user ID is required" });
    }

    try {
      const result = await this.gameService.canTransferGame(gameId, fromUserId, targetUserId as string);
      await this.createLog(req, 'canTransferGame', 'games', 200, fromUserId);
      res.send(result);
    } catch (error) {
      await this.createLog(req, 'canTransferGame', 'games', 500, fromUserId);
      handleError(res, error, "Error checking transfer eligibility");
    }
  }
}
