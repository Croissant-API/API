"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggedCheck = void 0;
const container_1 = __importDefault(require("../container"));
class LoggedCheck {
}
exports.LoggedCheck = LoggedCheck;
_a = LoggedCheck;
LoggedCheck.middleware = async (req, res, next) => {
    const authHeader = req.headers["authorization"] ||
        "Bearer " +
            req.headers["cookie"]?.toString().split("token=")[1]?.split(";")[0];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send({ message: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    if (!token) {
        return res.status(401).send({ message: "Unauthorized" });
    }
    const userService = container_1.default.get("UserService");
    const user = await userService.authenticateUser(token);
    if (!user) {
        return res.status(401).send({ message: "Unauthorized" });
    }
    if (user.disabled && !user.admin) {
        return res.status(403).send({ message: "Account is disabled" });
    }
    const role = user?.role;
    const roleUser = role ? await userService.getUser(role) : user;
    req.user = roleUser || user;
    req.originalUser = user;
    next();
};
