import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

export function genKey(userId: string): string {
    if (!userId) throw new Error('userId is required for key generation');
    return crypto.createHash('md5').update(userId + userId + process.env.HASH_SECRET).digest('hex');
}

// console.log('Key generation function loaded successfully.');
// console.log(genKey('724847846897221642')); // Example usage, should be removed in production