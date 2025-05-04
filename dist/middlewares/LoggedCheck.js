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
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send({ message: "Unauthorized" });
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
        return res.status(401).send({ message: "Unauthorized" });
    }
    const userService = container_1.default.get("UserService");
    const user = await userService.authenticateUser(token);
    if (!user) {
        return res.status(401).send({ message: "Unauthorized" });
    }
    req.user = user;
    next();
};
