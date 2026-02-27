import { MiddlewareHandler } from 'hono';
interface RateLimitConfig {
    windowMs: number;
    max: number;
    message: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
}
export declare const createRateLimit: (config: RateLimitConfig) => MiddlewareHandler;
export {};
