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
    constructor(userService, itemService, gameService, inventoryService, logService) {
        this.userService = userService;
        this.itemService = itemService;
        this.gameService = gameService;
        this.inventoryService = inventoryService;
        this.logService = logService;
    }
    async createLog(req, action, tableName, statusCode, userId, metadata) {
        try {
            const requestBody = { ...req.body, ...(metadata && { metadata }) };
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] || req.socket.remoteAddress,
                table_name: tableName,
                controller: `SearchController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: userId ?? req.user?.user_id,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error("Failed to log action:", error);
        }
    }
    async handleSearch(req, res, { admin = false, userId, } = {}) {
        const query = req.query.q?.trim();
        if (!query) {
            await this.createLog(req, admin ? "adminSearch" : "globalSearch", "search", 400, userId, { reason: "missing_query", ...(admin && { admin_search: true }) });
            return (0, helpers_1.sendError)(res, 400, "Missing search query");
        }
        try {
            const users = admin
                ? await this.userService.adminSearchUsers(query)
                : await this.userService.searchUsersByUsername(query);
            const detailledUsers = await Promise.all(users.map(async (user) => {
                const publicProfile = !admin ?
                    await this.userService.getUserWithPublicProfile(user.user_id) :
                    await this.userService.adminGetUserWithProfile(user.user_id);
                return { id: user.user_id, ...publicProfile };
            }));
            const items = await this.itemService.searchItemsByName(query);
            const games = (await this.gameService.listGames())
                .filter(g => g.showInStore && [g.name, g.description, g.genre].some(v => v && v.toLowerCase().includes(query.toLowerCase())))
                .map(game => (0, helpers_1.filterGame)(game));
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
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.createLog(req, admin ? "adminSearch" : "globalSearch", "search", 500, userId, {
                query,
                ...(admin && { admin_search: true }),
                error: msg,
            });
            res.status(500).send({ message: "Error searching", error: msg });
        }
    }
    async globalSearch(req, res) {
        const authHeader = req.headers["authorization"] ||
            "Bearer " +
                req.headers["cookie"]?.toString().split("token=")[1]?.split(";")[0];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const token = authHeader.split("Bearer ")[1];
        if (!token) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const user = await this.userService.authenticateUser(token);
        if (!user || !user.admin) {
            return this.handleSearch(req, res);
        }
        else {
            return this.handleSearch(req, res, { admin: true, userId: user.user_id });
        }
    }
};
exports.SearchController = SearchController;
__decorate([
    (0, inversify_express_utils_1.httpGet)("/"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SearchController.prototype, "globalSearch", null);
exports.SearchController = SearchController = __decorate([
    (0, inversify_express_utils_1.controller)("/search"),
    __param(0, (0, inversify_1.inject)("UserService")),
    __param(1, (0, inversify_1.inject)("ItemService")),
    __param(2, (0, inversify_1.inject)("GameService")),
    __param(3, (0, inversify_1.inject)("InventoryService")),
    __param(4, (0, inversify_1.inject)("LogService")),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object])
], SearchController);
