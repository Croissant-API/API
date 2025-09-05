import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpGet } from "inversify-express-utils";
import { IUserService } from "../services/UserService";
import { IItemService } from "../services/ItemService";
import { IGameService } from "../services/GameService";
import { IInventoryService } from "../services/InventoryService";
import { ILogService } from "../services/LogService";
import { sendError, filterGame } from "../utils/helpers";
import { AuthenticatedRequest } from "../middlewares/LoggedCheck";
import { PublicUser, User, UserExtensions } from "../interfaces/User";

@controller("/search")
export class SearchController {
    constructor(
        @inject("UserService") private userService: IUserService,
        @inject("ItemService") private itemService: IItemService,
        @inject("GameService") private gameService: IGameService,
        @inject("InventoryService") private inventoryService: IInventoryService,
        @inject("LogService") private logService: ILogService
    ) { }

    private async createLog(req: Request, action: string, tableName?: string, statusCode?: number, userId?: string, metadata?: object) {
        try {
            const requestBody = { ...req.body, ...(metadata && { metadata }) };
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

    private async handleSearch(
        req: Request | AuthenticatedRequest,
        res: Response,
        {
            admin = false,
            userId,
        }: { admin?: boolean; userId?: string } = {}
    ) {
        const query = (req.query.q as string)?.trim();
        if (!query) {
            await this.createLog(req, admin ? "adminSearch" : "globalSearch", "search", 400, userId, { reason: "missing_query", ...(admin && { admin_search: true }) });
            return sendError(res, 400, "Missing search query");
        }

        try {
            const users = admin
                ? await this.userService.adminSearchUsers(query)
                : await this.userService.searchUsersByUsername(query);

            const detailledUsers = await Promise.all(
                users.map(async (user: PublicUser & UserExtensions) => {
                    const publicProfile = await this.userService.getUserWithPublicProfile(user.user_id);
                    return { id: user.user_id, ...publicProfile };
                })
            );

            const items = await this.itemService.searchItemsByName(query);
            const games = (await this.gameService.listGames())
                .filter(g => g.showInStore && [g.name, g.description, g.genre].some(v => v && v.toLowerCase().includes(query.toLowerCase())))
                .map(game => filterGame(game));

            await this.createLog(req, admin ? "adminSearch" : "globalSearch", "search", 200, userId, {
                query,
                ...(admin && { admin_search: true }),
                results_count: {
                    users: detailledUsers.length,
                    items: items.length,
                    games: games.length,
                },
            });

            res.send({ users: detailledUsers, items, games });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.createLog(req, admin ? "adminSearch" : "globalSearch", "search", 500, userId, {
                query,
                ...(admin && { admin_search: true }),
                error: msg,
            });
            res.status(500).send({ message: "Error searching", error: msg });
        }
    }

    @httpGet("/")
    public async globalSearch(req: Request, res: Response) {
        const authHeader =
            req.headers["authorization"] ||
            "Bearer " +
            req.headers["cookie"]?.toString().split("token=")[1]?.split(";")[0];
        
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).send({ message: "Unauthorized" });
        }

        const token = authHeader.split("Bearer ")[1];
        if (!token) {
            return res.status(401).send({ message: "Unauthorized" });
        }

        const user: User | null = await this.userService.authenticateUser(token);
        if(!user || !user.admin) {
            return this.handleSearch(req, res);
        }
        else {
            return this.handleSearch(req, res, { admin: true, userId: user.user_id });
        }
    }
}
