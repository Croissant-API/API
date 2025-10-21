import { Context, Next } from 'hono';
import { Studio } from 'interfaces/Studio';
import { IItemService } from 'services/ItemService';
import { IStudioService } from 'services/StudioService';
import { IUserService } from 'services/UserService';
import container from '../container';

export const OwnerCheck = async (c: Context, next: Next) => {
  const authHeader = c.req.header('authorization') || 'Bearer ' + (c.req.header('cookie')?.split('token=')[1]?.split(';')[0] ?? '');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const roleCookie = c.req.header('cookie')?.split('role=')[1]?.split(';')[0];

  const userService = container.get('UserService') as IUserService;
  const itemService = container.get('ItemService') as IItemService;
  const studioService = container.get('StudioService') as IStudioService;
  if (!token) return c.json({ message: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const userId = body.userId;
  const itemId = body.itemId || c.req.param('itemId');
  const item = await itemService.getItem(itemId);
  const authedUser = await userService.authenticateUser(token);

  if (!authedUser) return c.json({ message: 'Invalid token' }, 401);

  const studios = await studioService.getUserStudios(authedUser.user_id);
  let owner = null;
  const roles = [authedUser.user_id, ...studios.map((s: Studio) => s.user_id)];
  if (roleCookie && roles.includes(roleCookie)) {
    owner = await userService.getUser(roleCookie);
  } else {
    owner = authedUser;
  }

  const user = await userService.getUser(userId);
  if (!item || item.deleted) return c.json({ message: 'Item not found' }, 404);
  if (!owner) return c.json({ message: 'Owner not found' }, 404);
  if (owner.user_id !== item.owner) return c.json({ message: 'You are not the owner of this item' }, 403);

  c.set('owner', owner);
  c.set('originalUser', authedUser);
  if (user) c.set('user', user);
  await next();
};
