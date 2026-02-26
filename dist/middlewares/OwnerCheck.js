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
OwnerCheck.middleware = async (c, next) => {
    const authHeader = c.req.header('authorization') ||
        'Bearer ' + (c.req.header('cookie')?.toString().split('token=')[1]?.split(';')[0] || '');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const roleCookie = c.req.header('cookie')?.toString().split('role=')[1]?.split(';')[0];
    const userService = container_1.default.get('UserService');
    const itemService = container_1.default.get('ItemService');
    if (!token) {
        return c.json({ message: 'Unauthorized' }, 401);
    }
    const body = await c.req.json().catch(() => ({}));
    const userId = body.userId;
    const itemId = body.itemId || c.req.param('itemId');
    const item = await itemService.getItem(itemId);
    const authedUser = (await userService.authenticateUser(token));
    const studioService = container_1.default.get('StudioService');
    const studios = await studioService.getUserStudios(authedUser.user_id);
    let owner = null;
    const roles = [authedUser.user_id, ...studios.map(s => s.user_id)];
    if (roleCookie && roles.includes(roleCookie)) {
        owner = await userService.getUser(roleCookie);
    }
    else {
        owner = authedUser;
    }
    const user = await userService.getUser(userId);
    if (!item || item.deleted) {
        return c.json({ message: 'Item not found' }, 404);
    }
    if (!owner) {
        return c.json({ message: 'Owner not found' }, 404);
    }
    if (owner.user_id !== item.owner) {
        return c.json({ message: 'You are not the owner of this item' }, 403);
    }
    c.set('owner', owner);
    c.set('originalUser', authedUser);
    if (user) {
        c.set('user', user);
    }
    return next();
};
