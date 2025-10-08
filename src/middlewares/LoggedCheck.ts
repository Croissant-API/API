import { NextFunction, Request, Response } from "express";
import { inject } from "inversify";
import container from "../container";
import { Studio } from "../interfaces/Studio";
import { User } from "../interfaces/User";
import { IStudioService } from "../services/StudioService";
import { IUserService } from "../services/UserService";

export interface AuthenticatedRequest extends Request {
  user: User;
  originalUser?: User; // Pour conserver l'utilisateur original avant modification de rôle
}

export class LoggedCheck {
  constructor(@inject("StudioService") private studioService: IStudioService) { }
  static middleware = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const authHeader =
      req.headers["authorization"] ||
      "Bearer " +
      req.headers["cookie"]?.toString().split("token=")[1]?.split(";")[0];
    const roleCookie = req.headers["cookie"]?.toString().split("role=")[1]?.split(";")[0];
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

    const studioService = container.get("StudioService") as IStudioService;
    const studios = await studioService.getUserStudios(user.user_id);
    const roles = [user.user_id, ...studios.map((s: Studio) => s.user_id)];

    let roleUser = null;
    if (roleCookie && roles.includes(roleCookie)) {
      roleUser = await userService.getUser(roleCookie);
    } else {
      roleUser = user;
    }

    (req as AuthenticatedRequest).user = roleUser || user;
    (req as AuthenticatedRequest).originalUser = user;
    next();
  };
}
