"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.genVerificationKey = exports.genKey = exports.decryptUserId = exports.encryptUserId = void 0;
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '..', '.env') });
const ALGO = 'aes-256-cbc';
const IV_LENGTH = 16;
function encryptUserId(userId) {
    const SECRET = process.env.HASH_SECRET;
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const key = crypto_1.default.createHash('sha256').update(SECRET).digest();
    const cipher = crypto_1.default.createCipheriv(ALGO, key, iv);
    let encrypted = cipher.update(userId, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}
exports.encryptUserId = encryptUserId;
function decryptUserId(apiKey) {
    try {
        const SECRET = process.env.HASH_SECRET;
        const [ivHex, encrypted] = apiKey.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = crypto_1.default.createHash('sha256').update(SECRET).digest();
        const decipher = crypto_1.default.createDecipheriv(ALGO, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch {
        return null;
    }
}
exports.decryptUserId = decryptUserId;
function createHash(userId, secret) {
    if (!userId)
        throw new Error('userId is required for key generation');
    if (!secret)
        throw new Error('Secret is not defined in environment variables');
    return crypto_1.default
        .createHash('md5')
        .update(userId + userId + secret)
        .digest('hex');
}
function genKey(userId) {
    const encryptedUserId = encryptUserId(userId);
    return encryptedUserId;
}
exports.genKey = genKey;
function genVerificationKey(userId) {
    return createHash(userId, process.env.VERIFICATION_SECRET);
}
exports.genVerificationKey = genVerificationKey;
