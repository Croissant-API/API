import { Context, Next } from 'hono';
export declare const OwnerCheck: (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    message: string;
}, 401, "json">) | (Response & import("hono").TypedResponse<{
    message: string;
}, 404, "json">) | (Response & import("hono").TypedResponse<{
    message: string;
}, 403, "json">) | undefined>;
