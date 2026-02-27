import { Context } from 'hono';
export declare class DescribeController {
    getDescriptions(c: Context): Promise<Response & import("hono").TypedResponse<any[], import("hono/utils/http-status").ContentfulStatusCode, "json">>;
}
