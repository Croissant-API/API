import { Context, Next } from 'hono';
export declare const LoggedCheck: (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    message: string;
}, 401, "json">) | (Response & import("hono").TypedResponse<{
    message: string;
}, 403, "json">) | undefined>;
