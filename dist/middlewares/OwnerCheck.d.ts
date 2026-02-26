import type { Request } from 'express';
import type { MiddlewareHandler } from 'hono';
import { User } from '../interfaces/User';
export interface AuthenticatedRequestWithOwner extends Request {
    owner: User;
    originalUser?: User;
    user?: User;
}
export declare class OwnerCheck {
    static middleware: MiddlewareHandler;
}
