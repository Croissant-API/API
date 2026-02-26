"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggedCheck = void 0;
const container_1 = __importDefault(require("../container"));
// Hono middleware version of LoggedCheck
class LoggedCheck {
}
exports.LoggedCheck = LoggedCheck;
_a = LoggedCheck;
// adapt express query parameters if needed
LoggedCheck.middleware = async (c, next) => {
    const authHeader = c.req.header('authorization') ||
        'Bearer ' + (c.req.header('cookie')?.toString().split('token=')[1]?.split(';')[0] || '');
    const roleCookie = c.req.header('cookie')?.toString().split('role=')[1]?.split(';')[0];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ message: 'Unauthorized' }, 401);
    }
    const token = authHeader.split('Bearer ')[1];
    if (!token) {
        return c.json({ message: 'Unauthorized' }, 401);
    }
    const userService = container_1.default.get('UserService');
    const user = await userService.authenticateUser(token);
    if (!user) {
        return c.json({ message: 'Unauthorized' }, 401);
    }
    if (user.disabled && !user.admin) {
        return c.json({ message: 'Account is disabled' }, 403);
    }
    const studioService = container_1.default.get('StudioService');
    const studios = await studioService.getUserStudios(user.user_id);
    const roles = [user.user_id, ...studios.map((s) => s.user_id)];
    let roleUser = null;
    if (roleCookie && roles.includes(roleCookie)) {
        roleUser = await userService.getUser(roleCookie);
    }
    else {
        roleUser = user;
    }
    c.set('user', roleUser || user);
    c.set('originalUser', user);
    return next();
};
