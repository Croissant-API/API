import type { Request } from 'express';
import type { MiddlewareHandler } from 'hono';
import { User } from '../interfaces/User';
export interface AuthenticatedRequest extends Request {
    user: User;
    originalUser?: User;
}
export declare class LoggedCheck {
    static middleware: MiddlewareHandler;
}
