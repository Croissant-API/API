"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchController = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const helpers_1 = require("../utils/helpers");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
let SearchController = class SearchController {
    constructor(userService, itemService, gameService, inventoryService, logService) {
        this.userService = userService;
        this.itemService = itemService;
        this.gameService = gameService;
        this.inventoryService = inventoryService;
        this.logService = logService;
    }
    // Helper pour les logs
    async logAction(req, tableName, statusCode, metadata) {
        try {
            const requestBody = { ...req.body };
            // Ajouter les métadonnées si fournies
            if (metadata) {
                requestBody.metadata = metadata;
            }
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] || req.socket.remoteAddress,
                table_name: tableName,
                controller: 'SearchController',
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: req.user?.user_id,
                status_code: statusCode
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    async globalSearch(req, res) {
        const query = req.query.q?.trim();
        if (!query) {
            await this.logAction(req, 'search', 400, { reason: 'missing_query' });
            return (0, helpers_1.sendError)(res, 400, "Missing search query");
        }
        try {
            const users = await this.userService.searchUsersByUsername(query);
            const detailledUsers = await Promise.all(users.map(async (user) => {
                if (user.disabled)
                    return null; // Skip disabled users
                const { inventory } = await this.inventoryService.getInventory(user.user_id);
                const formattedInventory = await (0, helpers_1.formatInventory)(inventory, this.itemService);
                const items = await this.itemService.getAllItems();
                const ownedItems = items.filter((i) => !i.deleted && i.owner === user?.user_id).map(helpers_1.mapItem);
                const games = await this.gameService.listGames();
                const createdGames = games.filter(g => g.owner_id === user?.user_id).map(g => (0, helpers_1.filterGame)(g, user?.user_id));
                return { ...(0, helpers_1.mapUserSearch)(user), inventory: formattedInventory, ownedItems, createdGames };
            }));
            const items = await this.itemService.searchItemsByName(query);
            const games = await this.gameService.listGames();
            const filteredGames = games.filter(g => g.showInStore && [g.name, g.description, g.genre].some(v => v && v.toLowerCase().includes(query.toLowerCase()))).map(g => (0, helpers_1.filterGame)(g));
            await this.logAction(req, 'search', 200, {
                query,
                results_count: {
                    users: detailledUsers.filter(u => u !== null).length,
                    items: items.length,
                    games: filteredGames.length
                }
            });
            res.send({ users: detailledUsers, items, games: filteredGames });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.logAction(req, 'search', 500, {
                query,
                error: msg
            });
            res.status(500).send({ message: "Error searching", error: msg });
        }
    }
    async adminSearch(req, res) {
        if (!req.user?.admin) {
            await this.logAction(req, 'search', 403, { reason: 'not_admin' });
            return (0, helpers_1.sendError)(res, 403, "Forbidden");
        }
        const query = req.query.q?.trim();
        if (!query) {
            await this.logAction(req, 'search', 400, { reason: 'missing_query', admin_search: true });
            return (0, helpers_1.sendError)(res, 400, "Missing search query");
        }
        try {
            const users = await this.userService.adminSearchUsers(query);
            const detailledUsers = await Promise.all(users.map(async (user) => {
                // if (user.disabled) return null; // Skip disabled users
                const { inventory } = await this.inventoryService.getInventory(user.user_id);
                const formattedInventory = await (0, helpers_1.formatInventory)(inventory, this.itemService);
                const items = await this.itemService.getAllItems();
                const ownedItems = items.filter((i) => !i.deleted && i.owner === user?.user_id).map(helpers_1.mapItem);
                const games = await this.gameService.listGames();
                const createdGames = games.filter(g => g.owner_id === user?.user_id).map(g => (0, helpers_1.filterGame)(g, user?.user_id));
                return { ...(0, helpers_1.mapUserSearch)(user), disabled: user.disabled, inventory: formattedInventory, ownedItems, createdGames };
            }));
            const items = await this.itemService.searchItemsByName(query);
            const games = await this.gameService.listGames();
            const filteredGames = games.filter(g => g.showInStore && [g.name, g.description, g.genre].some(v => v && v.toLowerCase().includes(query.toLowerCase()))).map(g => (0, helpers_1.filterGame)(g));
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
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.logAction(req, 'search', 500, {
                query,
                admin_search: true,
                error: msg
            });
            res.status(500).send({ message: "Error searching", error: msg });
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpGet)("/"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SearchController.prototype, "globalSearch", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/admin", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SearchController.prototype, "adminSearch", null);
SearchController = __decorate([
    (0, inversify_express_utils_1.controller)("/search"),
    __param(0, (0, inversify_1.inject)("UserService")),
    __param(1, (0, inversify_1.inject)("ItemService")),
    __param(2, (0, inversify_1.inject)("GameService")),
    __param(3, (0, inversify_1.inject)("InventoryService")),
    __param(4, (0, inversify_1.inject)("LogService")),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object])
], SearchController);
exports.SearchController = SearchController;
