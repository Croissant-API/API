import * as dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
export function generateUserJwt(user, apiKey) {
    return jwt.sign({
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        apiKey,
    }, JWT_SECRET, { expiresIn: '30d' });
}
export function verifyUserJwt(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
