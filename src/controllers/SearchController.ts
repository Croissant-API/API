import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpGet } from "inversify-express-utils";
import { IUserService } from "../services/UserService";
import { IItemService } from "../services/ItemService";
import { IGameService } from "../services/GameService";
import { IInventoryService } from "../services/InventoryService";
import { ILogService } from "../services/LogService";
import {
    sendError,
    formatInventory,
    mapUserSearch,
    filterGame,
    mapItem,
} from "../utils/helpers";
import { User } from "../interfaces/User";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";

@controller("/search")
export class SearchController {
    constructor(
        @inject("UserService") private userService: IUserService,
        @inject("ItemService") private itemService: IItemService,
        @inject("GameService") private gameService: IGameService,
        @inject("InventoryService") private inventoryService: IInventoryService,
        @inject("LogService") private logService: ILogService
    ) { }

    // Helper pour les logs
    private async logAction(
        req: Request,
        tableName?: string,
        statusCode?: number,
        metadata?: object
    ) {
        try {
            const requestBody = { ...req.body };
            
            // Ajouter les métadonnées si fournies
            if (metadata) {
                requestBody.metadata = metadata;
            }

            await this.logService.createLog({
                ip_address: req.ip || req.connection.remoteAddress || 'unknown',
                table_name: tableName,
                controller: 'SearchController',
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: (req as AuthenticatedRequest).user?.user_id as string,
                status_code: statusCode
            });
        } catch (error) {
            console.error('Failed to log action:', error);
        }
    }

    @httpGet("/")
    public async globalSearch(req: Request, res: Response) {
        const query = (req.query.q as string)?.trim();
        if (!query) {
            await this.logAction(req, 'search', 400, { reason: 'missing_query' });
            return sendError(res, 400, "Missing search query");
        }

        try {
            const users: User[] = await this.userService.searchUsersByUsername(query);
            const detailledUsers = await Promise.all(users.map(async (user) => {
                if (user.disabled) return null; // Skip disabled users
                const { inventory } = await this.inventoryService.getInventory(user.user_id);
                const formattedInventory = await formatInventory(inventory, this.itemService);
                const items = await this.itemService.getAllItems();
                const ownedItems = items.filter((i) => !i.deleted && i.owner === user?.user_id).map(mapItem);
                const games = await this.gameService.listGames();
                const createdGames = games.filter(g => g.owner_id === user?.user_id).map(g => filterGame(g, user?.user_id));
                return { ...mapUserSearch(user), inventory: formattedInventory, ownedItems, createdGames };
            }));

            const items = await this.itemService.searchItemsByName(query);
            const games = await this.gameService.listGames();
            const filteredGames = games.filter(
                g => g.showInStore && [g.name, g.description, g.genre].some(
                    v => v && v.toLowerCase().includes(query.toLowerCase())
                )
            ).map(g => filterGame(g));

            await this.logAction(req, 'search', 200, { 
                query,
                results_count: {
                    users: detailledUsers.filter(u => u !== null).length,
                    items: items.length,
                    games: filteredGames.length
                }
            });

            res.send({ users: detailledUsers, items, games: filteredGames });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.logAction(req, 'search', 500, { 
                query,
                error: msg
            });
            res.status(500).send({ message: "Error searching", error: msg });
        }
    }

    @httpGet("/admin", LoggedCheck.middleware)
    public async adminSearch(req: AuthenticatedRequest, res: Response) {
        if (!req.user?.admin) {
            await this.logAction(req, 'search', 403, { reason: 'not_admin' });
            return sendError(res, 403, "Forbidden");
        }

        const query = (req.query.q as string)?.trim();
        if (!query) {
            await this.logAction(req, 'search', 400, { reason: 'missing_query', admin_search: true });
            return sendError(res, 400, "Missing search query");
        }

        try {
            const users: User[] = await this.userService.adminSearchUsers(query);
            const detailledUsers = await Promise.all(users.map(async (user) => {
                // if (user.disabled) return null; // Skip disabled users
                const { inventory } = await this.inventoryService.getInventory(user.user_id);
                const formattedInventory = await formatInventory(inventory, this.itemService);
                const items = await this.itemService.getAllItems();
                const ownedItems = items.filter((i) => !i.deleted && i.owner === user?.user_id).map(mapItem);
                const games = await this.gameService.listGames();
                const createdGames = games.filter(g => g.owner_id === user?.user_id).map(g => filterGame(g, user?.user_id));
                return { ...mapUserSearch(user), disabled: user.disabled, inventory: formattedInventory, ownedItems, createdGames };
            }));

            const items = await this.itemService.searchItemsByName(query);
            const games = await this.gameService.listGames();
            const filteredGames = games.filter(
                g => g.showInStore && [g.name, g.description, g.genre].some(
                    v => v && v.toLowerCase().includes(query.toLowerCase())
                )
            ).map(g => filterGame(g));

            await this.logAction(req, 'search', 200, { 
                query,
                admin_search: true,
                results_count: {
                    users: detailledUsers.filter(u => u !== null).length,
                    items: items.length,
                    games: filteredGames.length
                }
            });

            res.send({ users: detailledUsers, items, games: filteredGames });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.logAction(req, 'search', 500, { 
                query,
                admin_search: true,
                error: msg
            });
            res.status(500).send({ message: "Error searching", error: msg });
        }
    }
}
