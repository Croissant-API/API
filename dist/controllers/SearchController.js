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
let SearchController = class SearchController {
    constructor(userService, itemService, gameService, inventoryService) {
        this.userService = userService;
        this.itemService = itemService;
        this.gameService = gameService;
        this.inventoryService = inventoryService;
    }
    async globalSearch(req, res) {
        const query = req.query.q?.trim();
        if (!query)
            return (0, helpers_1.sendError)(res, 400, "Missing search query");
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
            res.send({ users: detailledUsers, items, games: filteredGames });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
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
SearchController = __decorate([
    (0, inversify_express_utils_1.controller)("/search"),
    __param(0, (0, inversify_1.inject)("UserService")),
    __param(1, (0, inversify_1.inject)("ItemService")),
    __param(2, (0, inversify_1.inject)("GameService")),
    __param(3, (0, inversify_1.inject)("InventoryService")),
    __metadata("design:paramtypes", [Object, Object, Object, Object])
], SearchController);
exports.SearchController = SearchController;
