import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpGet, httpPost } from "inversify-express-utils";
import { ILobbyService } from "../services/LobbyService";
import {
  lobbyIdParamSchema,
  userIdParamSchema,
} from "../validators/LobbyValidator";
import { ValidationError } from "yup";
import { v4 } from "uuid";
import { describe } from "../decorators/describe";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";

@controller("/lobbies")
export class Lobbies {
  constructor(@inject("LobbyService") private lobbyService: ILobbyService) {}

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

      res.status(201).send({ message: "Lobby created" });
    } catch (error) {
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
    responseType: { lobbyId: "string", users: ["string"] },
    example: "GET /api/lobbies/123",
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
        return res
          .status(400)
          .send({ message: "Validation failed", errors: error.errors });
      }
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({ message: "Error fetching lobby", error: message });
    }
  }

  @describe({
    endpoint: "/lobbies/user/@me",
    method: "GET",
    description: "Get the lobby the authenticated user is in.",
    responseType: { lobbyId: "string", users: ["string"] },
    example: "GET /api/lobbies/user/@me",
    requiresAuth: true,
  })
  @httpGet("/user/@me", LoggedCheck.middleware)
  public async getMyLobby(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.user_id;
      const lobby = await this.lobbyService.getUserLobby(userId);
      if (!lobby) {
        return res.status(404).send({ message: "User is not in any lobby" });
      }
      res.send(lobby);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res
          .status(400)
          .send({ message: "Validation failed", errors: error.errors });
      }
      const message = error instanceof Error ? error.message : String(error);
      res
        .status(500)
        .send({ message: "Error fetching user lobby", error: message });
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
        return res
          .status(400)
          .send({ message: "Validation failed", errors: error.errors });
      }
      const message = error instanceof Error ? error.message : String(error);
      res
        .status(500)
        .send({ message: "Error fetching user lobby", error: message });
    }
  }

  // --- Actions sur un lobby ---
  @describe({
    endpoint: "/lobbies/:lobbyId/join",
    method: "POST",
    description: "Join a lobby.",
    params: { lobbyId: "The id of the lobby" },
    responseType: { message: "string" },
    example: "POST /api/lobbies/123/join",
    requiresAuth: true,
  })
  @httpPost("/:lobbyId/join", LoggedCheck.middleware)
  public async joinLobby(req: AuthenticatedRequest, res: Response) {
    try {
      await lobbyIdParamSchema.validate(req.params);
      const lobbyId = req.params.lobbyId;
      this.lobbyService.joinLobby(lobbyId, req.user.user_id).then(() => {
        res.status(200).send({ message: "Joined lobby" });
      }).catch((error) => {
        if (error instanceof ValidationError) {
          res.status(400).send({ message: "Validation failed", errors: error.errors });
        } else {
          const message = error instanceof Error ? error.message : String(error);
          res.status(500).send({ message: "Error joining lobby", error: message });
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res
          .status(400)
          .send({ message: "Validation failed", errors: error.errors });
      }
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({ message: "Error joining lobby", error: message });
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
    try {
      await lobbyIdParamSchema.validate(req.params);
      const lobbyId = req.params.lobbyId;
      await this.lobbyService.leaveLobby(lobbyId, req.user.user_id);
      res.status(200).send({ message: "Left lobby" });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res
          .status(400)
          .send({ message: "Validation failed", errors: error.errors });
      }
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({ message: "Error leaving lobby", error: message });
    }
  }
}
