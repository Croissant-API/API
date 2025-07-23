"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OwnerCheck = void 0;
const container_1 = __importDefault(require("../container"));
class OwnerCheck {
}
exports.OwnerCheck = OwnerCheck;
_a = OwnerCheck;
OwnerCheck.middleware = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
    const roleCookie = req.headers["cookie"]
        ?.toString()
        .split("role=")[1]
        ?.split(";")[0];
    const userService = container_1.default.get("UserService");
    const itemService = container_1.default.get("ItemService");
    if (!token) {
        return res.status(401).send({ message: "Unauthorized" });
    }
    const { userId } = req.body;
    const itemId = req.body.itemId || req.params.itemId;
    const item = await itemService.getItem(itemId);
    const authedUser = (await userService.authenticateUser(token));
    const studioService = container_1.default.get("StudioService");
    const studios = await studioService.getUserStudios(authedUser.user_id);
    let owner = null;
    const roles = [authedUser.user_id, ...studios.map((s) => s.user_id)];
    if (roleCookie && roles.includes(roleCookie)) {
        owner = await userService.getUser(roleCookie);
    }
    else {
        owner = authedUser;
    }
    const user = await userService.getUser(userId);
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
    req.owner = owner;
    req.originalUser = authedUser;
    if (user) {
        req.user = user;
    }
    next();
};
