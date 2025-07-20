import container from '../container';
import { Request, Response, NextFunction } from 'express';
import { Item } from '../interfaces/Item';
import { User } from '../interfaces/User';
import { IItemService } from '../services/ItemService';
import { IUserService } from '../services/UserService';

export interface AuthenticatedRequestWithOwner extends Request {
    owner: User;
    user?: User;
}

export class OwnerCheck {
    static middleware = async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        const userService = container.get("UserService") as IUserService;
        const itemService = container.get("ItemService") as IItemService; 

        if (!token) {
            return res.status(401).send({ message: "Unauthorized" });
        }

        const { userId } = req.body;
        const itemId = req.body.itemId || req.params.itemId;
        const item: Item | null = await itemService.getItem(itemId);
        const owner: User | null = await userService.authenticateUser(token);
        const user: User | null = await userService.getUser(userId);
        if (!item || item.deleted) {
            return res.status(404).send({ message: "Item not found" });
        }
        if (!owner) {
            return res.status(404).send({ message: "Owner not found" });
        }
        if (owner.user_id !== item.owner) {
            return res.status(403).send({ message: "You are not the owner of this item" });
        }

        (req as AuthenticatedRequestWithOwner).owner = owner;
        if (user) {
            (req as AuthenticatedRequestWithOwner).user = user;
        }
        next();
    }
}