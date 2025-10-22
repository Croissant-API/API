/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono';
import { controller, httpGet } from 'hono-inversify';
import { inject, injectable } from 'inversify';
import { IGameService } from '../services/GameService';
import { IInventoryService } from '../services/InventoryService';
import { IItemService } from '../services/ItemService';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
import { filterGame } from '../utils/helpers';
@injectable()
@controller('/search')
export class SearchController {
  constructor(
    @inject('UserService') private userService: IUserService,
    @inject('ItemService') private itemService: IItemService,
    @inject('GameService') private gameService: IGameService,
    @inject('InventoryService') private inventoryService: IInventoryService,
    @inject('LogService') private logService: ILogService
  ) {}

  private async createLog(c: Context, action: string, tableName?: string, statusCode?: number, userId?: string, metadata?: object, body?: any) {
    try {
      let requestBody: any = body || { note: 'Body not provided for logging' };
      if (metadata) requestBody = { ...requestBody, metadata };
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
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  private async handleSearch(c: Context, { admin = false, userId }: { admin?: boolean; userId?: string } = {}) {
    const query = (c.req.query('q') || '').trim();
    if (!query) {
      await this.createLog(c, admin ? 'adminSearch' : 'globalSearch', 'search', 400, userId, { reason: 'missing_query', ...(admin && { admin_search: true }) });
      return c.json({ message: 'Missing search query' }, 400);
    }

    try {
      const users = admin
        ? await this.userService.adminSearchUsers(query)
        : await this.userService.searchUsersByUsername(query);

      const detailledUsers = await Promise.all(
        users.map(async (user: any) => {
          const publicProfile = admin
            ? await this.userService.getUserWithCompleteProfile(user.user_id)
            : await this.userService.getUserWithPublicProfile(user.user_id);
          return { id: user.user_id, ...publicProfile };
        })
      );

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
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await this.createLog(c, admin ? 'adminSearch' : 'globalSearch', 'search', 500, userId, {
        query,
        ...(admin && { admin_search: true }),
        error: msg,
      });
      return c.json({ message: 'Error searching', error: msg }, 500);
    }
  }

  @httpGet('/')
  async globalSearch(c: Context) {
    const authHeader = c.req.header('authorization') ||
      'Bearer ' + (c.req.header('cookie')?.split('token=')[1]?.split(';')[0] || '');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ message: 'Unauthorized' }, 401);
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return c.json({ message: 'Unauthorized' }, 401);
    }

    const user: any = await this.userService.authenticateUser(token);
    if (!user || !user.admin) {
      return this.handleSearch(c);
    } else {
      return this.handleSearch(c, { admin: true, userId: user.user_id });
    }
  }
}
