import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpGet } from "inversify-express-utils";
import { IUserService } from "../services/UserService";
import { IItemService } from "../services/ItemService";
import { IGameService } from "../services/GameService";
import { IInventoryService } from "../services/InventoryService";
import { ILogService } from "../services/LogService";
import { sendError, filterGame } from "../utils/helpers";
import { PublicUser, PublicUserAsAdmin } from "../interfaces/User";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";

@controller("/search")
export class SearchController {
 constructor(
  @inject("UserService") private userService: IUserService,
  @inject("ItemService") private itemService: IItemService,
  @inject("GameService") private gameService: IGameService,
  @inject("InventoryService") private inventoryService: IInventoryService,
  @inject("LogService") private logService: ILogService
 ) {}

 // Helper pour les logs (uniformisé)
 private async createLog(req: Request, action: string, tableName?: string, statusCode?: number, userId?: string, metadata?: object) {
  try {
   const requestBody = { ...req.body };
   if (metadata) requestBody.metadata = metadata;
   await this.logService.createLog({
    ip_address: (req.headers["x-real-ip"] as string) || (req.socket.remoteAddress as string),
    table_name: tableName,
    controller: `SearchController.${action}`,
    original_path: req.originalUrl,
    http_method: req.method,
    request_body: requestBody,
    user_id: userId ?? ((req as AuthenticatedRequest).user?.user_id as string),
    status_code: statusCode,
   });
  } catch (error) {
   console.error("Failed to log action:", error);
  }
 }

 @httpGet("/")
 public async globalSearch(req: Request, res: Response) {
  const query = (req.query.q as string)?.trim();
  if (!query) {
   await this.createLog(req, "globalSearch", "search", 400, undefined, { reason: "missing_query" });
   return sendError(res, 400, "Missing search query");
  }

  try {
   const users: PublicUser[] = await this.userService.searchUsersByUsername(query);
   const detailledUsers = await Promise.all(
    users.map(async (user) => {
     const publicProfile = await this.userService.getUserWithPublicProfile(user.user_id);
     return { id: user.user_id, ...publicProfile };
    })
   );

   const items = await this.itemService.searchItemsByName(query);
   const games = await this.gameService.listGames();
   const filteredGames = games.filter((g) => g.showInStore && [g.name, g.description, g.genre].some((v) => v && v.toLowerCase().includes(query.toLowerCase()))).map((g) => filterGame(g));

   await this.createLog(req, "globalSearch", "search", 200, undefined, {
    query,
    results_count: {
     users: detailledUsers.filter((u) => u !== null).length,
     items: items.length,
     games: filteredGames.length,
    },
   });

   res.send({ users: detailledUsers.filter((u) => u !== null), items, games: filteredGames.filter((g) => g !== null) });
  } catch (error) {
   const msg = error instanceof Error ? error.message : String(error);
   await this.createLog(req, "globalSearch", "search", 500, undefined, {
    query,
    error: msg,
   });
   res.status(500).send({ message: "Error searching", error: msg });
  }
 }

 @httpGet("/admin", LoggedCheck.middleware)
 public async adminSearch(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.admin) {
   await this.createLog(req, "adminSearch", "search", 403, req.user?.user_id, { reason: "not_admin" });
   return sendError(res, 403, "Forbidden");
  }

  const query = (req.query.q as string)?.trim();
  if (!query) {
   await this.createLog(req, "adminSearch", "search", 400, req.user?.user_id, { reason: "missing_query", admin_search: true });
   return sendError(res, 400, "Missing search query");
  }

  try {
   const users: PublicUserAsAdmin[] = await this.userService.adminSearchUsers(query);
   const detailledUsers = await Promise.all(
    users.map(async (user) => {
     const publicProfile = await this.userService.getUserWithPublicProfile(user.user_id);
     return { id: user.user_id, disabled: user.disabled, ...publicProfile };
    })
   );

   const items = await this.itemService.searchItemsByName(query);
   const games = await this.gameService.listGames();
   const filteredGames = games.filter((g) => g.showInStore && [g.name, g.description, g.genre].some((v) => v && v.toLowerCase().includes(query.toLowerCase()))).map((g) => filterGame(g));

   await this.createLog(req, "adminSearch", "search", 200, req.user?.user_id, {
    query,
    admin_search: true,
    results_count: {
     users: detailledUsers.filter((u) => u !== null).length,
     items: items.length,
     games: filteredGames.length,
    },
   });

   res.send({ users: detailledUsers.filter((u) => u !== null), items, games: filteredGames.filter((g) => g !== null) });
  } catch (error) {
   const msg = error instanceof Error ? error.message : String(error);
   await this.createLog(req, "adminSearch", "search", 500, req.user?.user_id, {
    query,
    admin_search: true,
    error: msg,
   });
   res.status(500).send({ message: "Error searching", error: msg });
  }
 }
}
