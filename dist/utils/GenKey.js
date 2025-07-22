"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.genVerificationKey = exports.genKey = void 0;
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, "..", ".env") });
function createHash(userId, secret) {
    if (!userId)
        throw new Error("userId is required for key generation");
    if (!secret)
        throw new Error("Secret is not defined in environment variables");
    return crypto_1.default
        .createHash("md5")
        .update(userId + userId + secret)
        .digest("hex");
}
function genKey(userId) {
    return createHash(userId, process.env.HASH_SECRET);
}
exports.genKey = genKey;
function genVerificationKey(userId) {
    return createHash(userId, process.env.VERIFICATION_SECRET);
}
exports.genVerificationKey = genVerificationKey;
