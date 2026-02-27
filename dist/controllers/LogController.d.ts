import { Context } from 'hono';
import { ILogService } from '../services/LogService';
export declare class LogController {
    private logService;
    constructor(logService: ILogService);
    private getUserFromContext;
    private sendError;
    getAllLogs(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id?: number | undefined;
        timestamp: string;
        ip_address: string;
        table_name?: string | undefined;
        controller: string;
        original_path: string;
        http_method: string;
        request_body?: string | undefined;
        user_id?: string | undefined;
        status_code?: number | undefined;
        created_at?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getLogsByController(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id?: number | undefined;
        timestamp: string;
        ip_address: string;
        table_name?: string | undefined;
        controller: string;
        original_path: string;
        http_method: string;
        request_body?: string | undefined;
        user_id?: string | undefined;
        status_code?: number | undefined;
        created_at?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getLogsByUser(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id?: number | undefined;
        timestamp: string;
        ip_address: string;
        table_name?: string | undefined;
        controller: string;
        original_path: string;
        http_method: string;
        request_body?: string | undefined;
        user_id?: string | undefined;
        status_code?: number | undefined;
        created_at?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getLogsByTable(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id?: number | undefined;
        timestamp: string;
        ip_address: string;
        table_name?: string | undefined;
        controller: string;
        original_path: string;
        http_method: string;
        request_body?: string | undefined;
        user_id?: string | undefined;
        status_code?: number | undefined;
        created_at?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getLogStats(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        totalLogs: number;
        logsByController: {
            controller: string;
            count: number;
        }[];
        logsByTable: {
            table_name: string;
            count: number;
        }[];
    }, import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
    getMyLogs(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        id?: number | undefined;
        timestamp: string;
        ip_address: string;
        table_name?: string | undefined;
        controller: string;
        original_path: string;
        http_method: string;
        request_body?: string | undefined;
        user_id?: string | undefined;
        status_code?: number | undefined;
        created_at?: string | undefined;
    }[], import("hono/utils/http-status").ContentfulStatusCode, "json">)>;
}
