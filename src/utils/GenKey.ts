import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ALGO = 'aes-256-cbc';
const IV_LENGTH = 16;

export function encryptUserId(userId: string): string {
  const SECRET = process.env.HASH_SECRET!;

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.createHash('sha256').update(SECRET).digest();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(userId, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptUserId(apiKey: string): string | null {
  try {
    const SECRET = process.env.HASH_SECRET!;
    const [ivHex, encrypted] = apiKey.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.createHash('sha256').update(SECRET).digest();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

function createHash(userId: string, secret: string | undefined): string {
  if (!userId) throw new Error('userId is required for key generation');
  if (!secret) throw new Error('Secret is not defined in environment variables');
  return crypto
    .createHash('md5')
    .update(userId + userId + secret)
    .digest('hex');
}

export function genKey(userId: string): string {
  const encryptedUserId = encryptUserId(userId);
  return encryptedUserId;
}

export function genVerificationKey(userId: string): string {
  return createHash(userId, process.env.VERIFICATION_SECRET);
}
