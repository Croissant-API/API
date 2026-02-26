import type { Request } from 'express';
import type { Context, MiddlewareHandler } from 'hono';
import container from '../container';
import { Item } from '../interfaces/Item';
import { User } from '../interfaces/User';
import { IItemService } from '../services/ItemService';
import { IStudioService } from '../services/StudioService';
import { IUserService } from '../services/UserService';

// legacy interface for compile-time compatibility
export interface AuthenticatedRequestWithOwner extends Request {
  owner: User;
  originalUser?: User;
  user?: User;
}

export class OwnerCheck {
  static middleware: MiddlewareHandler = async (c: Context, next) => {
    const authHeader =
      c.req.header('authorization') ||
      'Bearer ' + (c.req.header('cookie')?.toString().split('token=')[1]?.split(';')[0] || '');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const roleCookie = c.req.header('cookie')?.toString().split('role=')[1]?.split(';')[0];

    const userService = container.get('UserService') as IUserService;
    const itemService = container.get('ItemService') as IItemService;

    if (!token) {
      return c.json({ message: 'Unauthorized' }, 401);
    }

    const body = await c.req.json().catch(() => ({} as any));
    const userId = body.userId;
    const itemId = body.itemId || c.req.param('itemId');
    const item: Item | null = await itemService.getItem(itemId);
    const authedUser: User = (await userService.authenticateUser(token)) as User;

    const studioService = container.get('StudioService') as IStudioService;
    const studios = await studioService.getUserStudios(authedUser.user_id);

    let owner: User | null = null;
    const roles = [authedUser.user_id, ...studios.map(s => s.user_id)];
    if (roleCookie && roles.includes(roleCookie)) {
      owner = await userService.getUser(roleCookie);
    } else {
      owner = authedUser;
    }

    const user: User | null = await userService.getUser(userId);
    if (!item || item.deleted) {
      return c.json({ message: 'Item not found' }, 404);
    }
    if (!owner) {
      return c.json({ message: 'Owner not found' }, 404);
    }
    if (owner.user_id !== item.owner) {
      return c.json({ message: 'You are not the owner of this item' }, 403);
    }

    c.set('owner', owner);
    c.set('originalUser', authedUser);
    if (user) {
      c.set('user', user);
    }

    return next();
  };
}
