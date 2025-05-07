import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, "..", ".env") });
export function genKey(userId) {
    if (!userId)
        throw new Error('userId is required for key generation');
    return crypto.createHash('md5').update(userId + userId + process.env.HASH_SECRET).digest('hex');
}
export function genVerificationKey(userId) {
    if (!userId)
        throw new Error('userId is required for key generation');
    return crypto.createHash('md5').update(userId + userId + process.env.VERIFICATION_SECRET).digest('hex');
}
// console.log('Key generation function loaded successfully.');
// console.log(genKey('724847846897221642')); // Example usage, should be removed in production
