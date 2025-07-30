import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpGet, httpPost } from "inversify-express-utils";
import { ILobbyService } from "../services/LobbyService";
import {
  lobbyIdParamSchema,
  userIdParamSchema,
} from "../validators/LobbyValidator";
import { ValidationError, Schema } from "yup";
import { v4 } from "uuid";
import { describe } from "../decorators/describe";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { ILogService } from "../services/LogService"; // Ajout import LogService

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

@controller("/lobbies")
export class Lobbies {
  constructor(
    @inject("LobbyService") private lobbyService: ILobbyService,
    @inject("LogService") private logService: ILogService // Ajout injection LogService
  ) {}

  // Helper pour créer des logs
  private async createLog(req: Request, controller: string, tableName?: string, statusCode?: number, userId?: string) {
    try {
      await this.logService.createLog({
        ip_address: req.headers["x-real-ip"] as string || req.socket.remoteAddress as string,
        table_name: tableName,
        controller: `LobbyController.${controller}`,
        original_path: req.originalUrl,
        http_method: req.method,
        request_body: req.body,
        user_id: userId,
        status_code: statusCode
      });
    } catch (error) {
      // On ne bloque jamais la route sur une erreur de log
      console.error('Error creating log:', error);
    }
  }

  // --- Création de lobby ---
  @describe({
    endpoint: "/lobbies",
    method: "POST",
    description: "Create a new lobby.",
    responseType: { message: "string" },
    example: "POST /api/lobbies",
    requiresAuth: true,
  })
  @httpPost("/", LoggedCheck.middleware)
  public async createLobby(req: AuthenticatedRequest, res: Response) {
    try {
      const lobbyId = v4(); // Generate a new UUID for the lobbyId
      await this.lobbyService.createLobby(lobbyId, [req.user.user_id]);
      await this.lobbyService.joinLobby(lobbyId, req.user.user_id);

      await this.createLog(req, 'createLobby', 'lobbies', 201, req.user.user_id);
      res.status(201).send({ message: "Lobby created" });
    } catch (error) {
      await this.createLog(req, 'createLobby', 'lobbies', 500, req.user?.user_id);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({ message: "Error creating lobby", error: message });
    }
  }

  // --- Récupération d’un lobby ---
  @describe({
    endpoint: "/lobbies/:lobbyId",
    method: "GET",
    description: "Get a lobby by lobbyId",
    params: { lobbyId: "The id of the lobby" },
    responseType: { 
      lobbyId: "string", 
      users: [{
        username: "string",
        user_id: "string", 
        verified: "boolean",
        steam_username: "string",
        steam_avatar_url: "string",
        steam_id: "string"
      }]
    },
    example: "GET /api/lobbies/123",
  })
  @httpGet("/:lobbyId")
  public async getLobby(req: Request, res: Response) {
    if (!(await validateOr400(lobbyIdParamSchema, req.params, res))) {
      await this.createLog(req, 'getLobby', 'lobbies', 400);
      return;
    }
    try {
      const lobbyId = req.params.lobbyId;
      const lobby = await this.lobbyService.getFormattedLobby(lobbyId);
      if (!lobby) {
        await this.createLog(req, 'getLobby', 'lobbies', 404);
        return res.status(404).send({ message: "Lobby not found" });
      }
      await this.createLog(req, 'getLobby', 'lobbies', 200);
      res.send(lobby);
    } catch (error) {
      await this.createLog(req, 'getLobby', 'lobbies', 500);
      handleError(res, error, "Error fetching lobby");
    }
  }

  @describe({
    endpoint: "/lobbies/user/@me",
    method: "GET",
    description: "Get the lobby the authenticated user is in.",
    responseType: { success: "boolean", lobbyId: "string", users: ["string"] },
    example: "GET /api/lobbies/user/@me",
    requiresAuth: true,
  })
  @httpGet("/user/@me", LoggedCheck.middleware)
  public async getMyLobby(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.user_id;
      const lobby = await this.lobbyService.getUserLobby(userId);
      if (!lobby) {
        await this.createLog(req, 'getMyLobby', 'lobbies', 200, userId);
        return res.status(200).send({ success: false, message: "User is not in any lobby" });
      }
      await this.createLog(req, 'getMyLobby', 'lobbies', 200, userId);
      res.send({ success: true, ...lobby });
    } catch (error) {
      await this.createLog(req, 'getMyLobby', 'lobbies', 500, req.user?.user_id);
      handleError(res, error, "Error fetching user lobby");
    }
  }

  @describe({
    endpoint: "/lobbies/user/:userId",
    method: "GET",
    description: "Get the lobby a user is in",
    params: { userId: "The id of the user" },
    responseType: { lobbyId: "string", users: ["string"] },
    example: "GET /api/lobbies/user/123",
  })
  @httpGet("/user/:userId")
  public async getUserLobby(req: Request, res: Response) {
    if (!(await validateOr400(userIdParamSchema, req.params, res))) {
      await this.createLog(req, 'getUserLobby', 'lobbies', 400, req.params.userId);
      return;
    }
    try {
      const { userId } = req.params;
      const lobby = await this.lobbyService.getUserLobby(userId);
      if (!lobby) {
        await this.createLog(req, 'getUserLobby', 'lobbies', 404, userId);
        return res.status(404).send({ message: "User is not in any lobby" });
      }
      await this.createLog(req, 'getUserLobby', 'lobbies', 200, userId);
      res.send(lobby);
    } catch (error) {
      await this.createLog(req, 'getUserLobby', 'lobbies', 500, req.params.userId);
      handleError(res, error, "Error fetching user lobby");
    }
  }

  // --- Actions sur un lobby ---
  @describe({
    endpoint: "/lobbies/:lobbyId/join",
    method: "POST",
    description: "Join a lobby. This will make the user leave all other lobbies first.",
    params: { lobbyId: "The id of the lobby" },
    responseType: { message: "string" },
    example: "POST /api/lobbies/123/join",
    requiresAuth: true,
  })
  @httpPost("/:lobbyId/join", LoggedCheck.middleware)
  public async joinLobby(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(lobbyIdParamSchema, req.params, res))) {
      await this.createLog(req, 'joinLobby', 'lobbies', 400, req.user.user_id);
      return;
    }
    try {
      // Quitter tous les autres lobbies avant de rejoindre le nouveau
      await this.lobbyService.leaveAllLobbies(req.user.user_id);
      await this.lobbyService.joinLobby(req.params.lobbyId, req.user.user_id);
      await this.createLog(req, 'joinLobby', 'lobbies', 200, req.user.user_id);
      res.status(200).send({ message: "Joined lobby" });
    } catch (error) {
      await this.createLog(req, 'joinLobby', 'lobbies', 500, req.user.user_id);
      handleError(res, error, "Error joining lobby");
    }
  }

  @describe({
    endpoint: "/lobbies/:lobbyId/leave",
    method: "POST",
    description: "Leave a lobby.",
    params: { lobbyId: "The id of the lobby" },
    responseType: { message: "string" },
    example: "POST /api/lobbies/123/leave",
    requiresAuth: true,
  })
  @httpPost("/:lobbyId/leave", LoggedCheck.middleware)
  public async leaveLobby(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(lobbyIdParamSchema, req.params, res))) {
      await this.createLog(req, 'leaveLobby', 'lobbies', 400, req.user.user_id);
      return;
    }
    try {
      await this.lobbyService.leaveLobby(req.params.lobbyId, req.user.user_id);
      await this.createLog(req, 'leaveLobby', 'lobbies', 200, req.user.user_id);
      res.status(200).send({ message: "Left lobby" });
    } catch (error) {
      await this.createLog(req, 'leaveLobby', 'lobbies', 500, req.user.user_id);
      handleError(res, error, "Error leaving lobby");
    }
  }
}
