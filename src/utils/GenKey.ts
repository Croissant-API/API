import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });
function createHash(userId: string, secret: string | undefined): string {
    if (!userId) throw new Error("userId is required for key generation");
    if (!secret) throw new Error("Secret is not defined in environment variables");
    return crypto
        .createHash("md5")
        .update(userId + userId + secret)
        .digest("hex");
}

export function genKey(userId: string): string {
    return createHash(userId, process.env.HASH_SECRET);
}

export function genVerificationKey(userId: string): string {
    return createHash(userId, process.env.VERIFICATION_SECRET);
}