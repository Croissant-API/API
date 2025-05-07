var _a;
import container from '../container';
export class LoggedCheck {
}
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
    const userService = container.get("UserService");
    const user = await userService.authenticateUser(token);
    if (!user) {
        return res.status(401).send({ message: "Unauthorized" });
    }
    req.user = user;
    next();
};
