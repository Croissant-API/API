import container from '../container';
import { Request, Response, NextFunction } from 'express';
import { User } from '../interfaces/User';
import { IUserService } from '../services/UserService';

export interface AuthenticatedRequest extends Request {
    user: User;
    originalUser?: User; // Pour conserver l'utilisateur original avant modification de rôle
}

export class LoggedCheck {
    static middleware = async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers["authorization"] || "Bearer " + req.headers["cookie"]?.toString().split("token=")[1]?.split(";")[0];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).send({ message: "Unauthorized" });
        }

        const token = authHeader.split("Bearer ")[1];
        if (!token) {
            return res.status(401).send({ message: "Unauthorized" });
        }

        const userService = container.get("UserService") as IUserService;
        const user: User | null = await userService.authenticateUser(token);

        if (!user) {
            return res.status(401).send({ message: "Unauthorized" });
        }

        if (user.disabled && !user.admin) {
            return res.status(403).send({ message: "Account is disabled" });
        }

        const role = user?.role;
        const roleUser = role ? await userService.getUser(role) : user;

        (req as AuthenticatedRequest).user = roleUser || user;
        (req as AuthenticatedRequest).originalUser = user;
        next();
    }
}