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
import { controller, httpGet } from 'hono-inversify';
import { inject, injectable } from 'inversify';
import { filterGame } from '../utils/helpers';
let SearchController = class SearchController {
    constructor(userService, itemService, gameService, inventoryService, logService) {
        this.userService = userService;
        this.itemService = itemService;
        this.gameService = gameService;
        this.inventoryService = inventoryService;
        this.logService = logService;
    }
    async createLog(c, action, tableName, statusCode, userId, metadata, body) {
        try {
            let requestBody = body || { note: 'Body not provided for logging' };
            if (metadata)
                requestBody = { ...requestBody, metadata };
            const clientIP = c.req.header('cf-connecting-ip') ||
                c.req.header('x-forwarded-for') ||
                c.req.header('x-real-ip') ||
                'unknown';
            await this.logService.createLog({
                ip_address: clientIP,
                table_name: tableName,
                controller: `SearchController.${action}`,
                original_path: c.req.path,
                http_method: c.req.method,
                request_body: JSON.stringify(requestBody),
                user_id: userId,
                status_code: statusCode,
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    async handleSearch(c, { admin = false, userId } = {}) {
        const query = (c.req.query('q') || '').trim();
        if (!query) {
            await this.createLog(c, admin ? 'adminSearch' : 'globalSearch', 'search', 400, userId, { reason: 'missing_query', ...(admin && { admin_search: true }) });
            return c.json({ message: 'Missing search query' }, 400);
        }
        try {
            const users = admin
                ? await this.userService.adminSearchUsers(query)
                : await this.userService.searchUsersByUsername(query);
            const detailledUsers = await Promise.all(users.map(async (user) => {
                const publicProfile = admin
                    ? await this.userService.getUserWithCompleteProfile(user.user_id)
                    : await this.userService.getUserWithPublicProfile(user.user_id);
                return { id: user.user_id, ...publicProfile };
            }));
            const items = await this.itemService.searchItemsByName(query);
            const games = (await this.gameService.listGames())
                .filter(g => g.showInStore && [g.name, g.description, g.genre].some(v => v && v.toLowerCase().includes(query.toLowerCase())))
                .map(game => filterGame(game));
            await this.createLog(c, admin ? 'adminSearch' : 'globalSearch', 'search', 200, userId, {
                query,
                ...(admin && { admin_search: true }),
                results_count: {
                    users: detailledUsers.length,
                    items: items.length,
                    games: games.length,
                },
            });
            return c.json({ users: detailledUsers, items, games }, 200);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.createLog(c, admin ? 'adminSearch' : 'globalSearch', 'search', 500, userId, {
                query,
                ...(admin && { admin_search: true }),
                error: msg,
            });
            return c.json({ message: 'Error searching', error: msg }, 500);
        }
    }
    async globalSearch(c) {
        const authHeader = c.req.header('authorization') ||
            'Bearer ' + (c.req.header('cookie')?.split('token=')[1]?.split(';')[0] || '');
        let token = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split('Bearer ')[1];
        }
        let user = null;
        if (token) {
            try {
                user = await this.userService.authenticateUser(token);
            }
            catch (error) {
                // Token invalid, continue as unlogged user
            }
        }
        if (user && user.admin) {
            return this.handleSearch(c, { admin: true, userId: user.user_id });
        }
        else if (user) {
            return this.handleSearch(c, { admin: false, userId: user.user_id });
        }
        else {
            // Unlogged user
            return this.handleSearch(c, { admin: false });
        }
    }
};
__decorate([
    httpGet('/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], SearchController.prototype, "globalSearch", null);
SearchController = __decorate([
    injectable(),
    controller('/search'),
    __param(0, inject('UserService')),
    __param(1, inject('ItemService')),
    __param(2, inject('GameService')),
    __param(3, inject('InventoryService')),
    __param(4, inject('LogService')),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object])
], SearchController);
export { SearchController };
