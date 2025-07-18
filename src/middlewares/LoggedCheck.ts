import container from '../container';
import { Request, Response, NextFunction } from 'express';
import { User } from '../interfaces/User';
import { IUserService } from '../services/UserService';

export interface AuthenticatedRequest extends Request {
    user: User;
}

export class LoggedCheck {
    static middleware = async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).send({ message: "Unauthorized" });
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).send({ message: "Unauthorized" });
        }

        const userService = container.get("UserService") as IUserService;
        const user: User | null = await userService.authenticateUser(token);
        if (!user) {
            return res.status(401).send({ message: "Unauthorized" });
        }

        (req as AuthenticatedRequest).user = user;
        next();
    }
}