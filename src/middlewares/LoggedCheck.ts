import type { Request } from 'express';
import type { Context, MiddlewareHandler } from 'hono';
import container from '../container';
import { Studio } from '../interfaces/Studio';
import { User } from '../interfaces/User';
import { IStudioService } from '../services/StudioService';
import { IUserService } from '../services/UserService';

// preserve the original interface for controllers that still reference it
export interface AuthenticatedRequest extends Request {
  user: User;
  originalUser?: User;
}

// Hono middleware version of LoggedCheck

export class LoggedCheck {
  // adapt express query parameters if needed
  static middleware: MiddlewareHandler = async (c: Context, next) => {
    const authHeader =
      c.req.header('authorization') ||
      'Bearer ' + (c.req.header('cookie')?.toString().split('token=')[1]?.split(';')[0] || '');
    const roleCookie = c.req.header('cookie')?.toString().split('role=')[1]?.split(';')[0];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ message: 'Unauthorized' }, 401);
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return c.json({ message: 'Unauthorized' }, 401);
    }

    const userService = container.get('UserService') as IUserService;
    const user: User | null = await userService.authenticateUser(token);

    if (!user) {
      return c.json({ message: 'Unauthorized' }, 401);
    }

    if (user.disabled && !user.admin) {
      return c.json({ message: 'Account is disabled' }, 403);
    }

    const studioService = container.get('StudioService') as IStudioService;
    const studios = await studioService.getUserStudios(user.user_id);
    const roles = [user.user_id, ...studios.map((s: Studio) => s.user_id)];

    let roleUser: User | null = null;
    if (roleCookie && roles.includes(roleCookie)) {
      roleUser = await userService.getUser(roleCookie);
    } else {
      roleUser = user;
    }

    c.set('user', roleUser || user);
    c.set('originalUser', user);

    return next();
  };
}
