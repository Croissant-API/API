"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.genVerificationKey = exports.genKey = void 0;
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function genKey(userId) {
    if (!userId)
        throw new Error('userId is required for key generation');
    return crypto_1.default.createHash('md5').update(userId + userId + process.env.HASH_SECRET).digest('hex');
}
exports.genKey = genKey;
function genVerificationKey(userId) {
    if (!userId)
        throw new Error('userId is required for key generation');
    return crypto_1.default.createHash('md5').update(userId + userId + process.env.VERIFICATION_SECRET).digest('hex');
}
exports.genVerificationKey = genVerificationKey;
// console.log('Key generation function loaded successfully.');
// console.log(genKey('724847846897221642')); // Example usage, should be removed in production
