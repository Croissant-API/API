var _a;
import container from '../container';
export class OwnerCheck {
}
_a = OwnerCheck;
OwnerCheck.middleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const userService = container.get("UserService");
    const itemService = container.get("ItemService");
    if (!token) {
        return res.status(401).send({ message: "Unauthorized" });
    }
    const { userId } = req.body;
    const itemId = req.body.itemId || req.params.itemId;
    const item = await itemService.getItem(itemId);
    const owner = await userService.authenticateUser(token);
    const user = await userService.getUser(userId);
    if (!item || item.deleted) {
        return res.status(404).send({ message: "Item not found" });
    }
    if (!owner) {
        return res.status(404).send({ message: "Owner not found" });
    }
    if (owner.user_id !== item.owner) {
        return res.status(403).send({ message: "You are not the owner of this item" });
    }
    req.owner = owner;
    req.user = user;
    next();
};
