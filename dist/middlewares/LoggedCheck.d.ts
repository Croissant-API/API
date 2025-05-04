import { Request, Response, NextFunction } from 'express';
import { User } from '../interfaces/User';
export interface AuthenticatedRequest extends Request {
    user: User;
}
export declare class LoggedCheck {
    static middleware: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
}
