
import { Context, Next } from 'hono';
import { StudioService } from 'services/StudioService';
import { UserService } from 'services/UserService';
import container from '../container';

export const LoggedCheck = async (c: Context, next: Next) => {
  const authHeader = c.req.header('authorization') || 'Bearer ' + (c.req.header('cookie')?.split('token=')[1]?.split(';')[0] ?? '');
  const roleCookie = c.req.header('cookie')?.split('role=')[1]?.split(';')[0];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ message: 'Unauthorized' }, 401);

  const token = authHeader.split('Bearer ')[1];
  if (!token) return c.json({ message: 'Unauthorized' }, 401);

  const userService = container.get('UserService') as UserService;
  const user = await userService.authenticateUser(token);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);
  if (user.disabled && !user.admin) return c.json({ message: 'Account is disabled' }, 403);

  const studioService = container.get('StudioService') as StudioService;
  const studios = await studioService.getUserStudios(user.user_id);
  const roles = [user.user_id, ...studios.map((s) => s.user_id)];

  let roleUser = null;
  if (roleCookie && roles.includes(roleCookie)) {
    roleUser = await userService.getUser(roleCookie);
  } else {
    roleUser = user;
  }

  c.set('user', roleUser || user);
  c.set('originalUser', user);
  await next();
};
