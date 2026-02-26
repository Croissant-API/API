"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUserJwt = exports.generateUserJwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// JWT_SECRET must be provided via environment (Wrangler secrets or Node env)
const JWT_SECRET = process.env.JWT_SECRET;
function generateUserJwt(user, apiKey) {
    return jsonwebtoken_1.default.sign({
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        apiKey,
    }, JWT_SECRET, { expiresIn: '30d' });
}
exports.generateUserJwt = generateUserJwt;
function verifyUserJwt(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
exports.verifyUserJwt = verifyUserJwt;
