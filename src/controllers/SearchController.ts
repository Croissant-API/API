import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpGet } from "inversify-express-utils";
import { IUserService } from "../services/UserService";
import { IItemService } from "../services/ItemService";
import { IGameService } from "../services/GameService";
import { IInventoryService } from "../services/InventoryService";
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
        @inject("InventoryService") private inventoryService: IInventoryService
    ) { }

    @httpGet("/")
    public async globalSearch(req: Request, res: Response) {
        const query = (req.query.q as string)?.trim();
        if (!query) return sendError(res, 400, "Missing search query");
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
            res.send({ users: detailledUsers, items, games: filteredGames });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error searching", error: msg });
        }
    }

    @httpGet("/admin", LoggedCheck.middleware)
    public async adminSearch(req: AuthenticatedRequest, res: Response) {
        if (!req.user?.admin) return sendError(res, 403, "Forbidden");
        const query = (req.query.q as string)?.trim();
        if (!query) return sendError(res, 400, "Missing search query");
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
            res.send({ users: detailledUsers, items, games: filteredGames });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error searching", error: msg });
        }
    }
}
