import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;

export function generateUserJwt(user: { user_id: string; username: string; email: string; }, apiKey: string) {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      apiKey,
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

export function verifyUserJwt(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as {
      user_id: string;
      username: string;
      email: string;
      apiKey: string;
    };
  } catch {
    return null;
  }
}