import { Request, Response, NextFunction } from 'express';
import { User } from '../interfaces/User';
export interface AuthenticatedRequestWithOwner extends Request {
    owner: User;
    user?: User | null;
}
export declare class OwnerCheck {
    static middleware: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
}
