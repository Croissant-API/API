"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.genVerificationKey = exports.genKey = exports.decryptUserId = exports.encryptUserId = void 0;
// Use the Web Crypto API when running in the worker environment
const crypto = globalThis.crypto || require('crypto');
// dotenv is intentionally not loaded here; environment variables should
// be injected by the host (local Node or Wrangler).
const ALGO = 'aes-256-cbc';
const IV_LENGTH = 16;
function encryptUserId(userId) {
    const SECRET = process.env.HASH_SECRET;
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.createHash('sha256').update(SECRET).digest();
    const cipher = crypto.createCipheriv(ALGO, key, iv);
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
        const key = crypto.createHash('sha256').update(SECRET).digest();
        const decipher = crypto.createDecipheriv(ALGO, key, iv);
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
    return crypto
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
