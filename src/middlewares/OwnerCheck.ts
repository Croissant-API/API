import { NextFunction, Request, Response } from "express";
import container from "../container";
import { Item } from "../interfaces/Item";
import { User } from "../interfaces/User";
import { IItemService } from "../services/ItemService";
import { IStudioService } from "../services/StudioService";
import { IUserService } from "../services/UserService";

export interface AuthenticatedRequestWithOwner extends Request {
  owner: User;
  originalUser?: User; // Pour conserver l'utilisateur original avant modification de rôle
  user?: User;
}

export class OwnerCheck {
  static middleware = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const authHeader =
      req.headers["authorization"] ||
      "Bearer " +
      req.headers["cookie"]?.toString().split("token=")[1]?.split(";")[0];
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
    const roleCookie = req.headers["cookie"]
      ?.toString()
      .split("role=")[1]
      ?.split(";")[0];

    const userService = container.get("UserService") as IUserService;
    const itemService = container.get("ItemService") as IItemService;

    if (!token) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const { userId } = req.body;
    const itemId = req.body.itemId || req.params.itemId;
    const item: Item | null = await itemService.getItem(itemId);
    const authedUser: User = (await userService.authenticateUser(
      token
    )) as User;

    const studioService = container.get("StudioService") as IStudioService;
    const studios = await studioService.getUserStudios(authedUser.user_id);

    let owner = null;
    const roles = [authedUser.user_id, ...studios.map((s) => s.user_id)];
    if (roleCookie && roles.includes(roleCookie)) {
      owner = await userService.getUser(roleCookie);
    } else {
      owner = authedUser;
    }

    const user: User | null = await userService.getUser(userId);
    if (!item || item.deleted) {
      return res.status(404).send({ message: "Item not found" });
    }
    if (!owner) {
      return res.status(404).send({ message: "Owner not found" });
    }
    if (owner.user_id !== item.owner) {
      return res
        .status(403)
        .send({ message: "You are not the owner of this item" });
    }

    (req as AuthenticatedRequestWithOwner).owner = owner;
    (req as AuthenticatedRequestWithOwner).originalUser = authedUser;
    if (user) {
      (req as AuthenticatedRequestWithOwner).user = user;
    }
    next();
  };
}
