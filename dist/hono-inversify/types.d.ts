import { MiddlewareHandler } from 'hono';
export interface HonoHandlerResult {
    [key: string]: unknown;
}
export interface HonoHandlerDecorator {
    path?: string | RegExp;
    method: string;
    middleware?: MiddlewareHandler[];
    target: object;
    key: string;
    descriptor: PropertyDescriptor;
}
export declare const TYPE: {
    HonoRequestHandler: symbol;
};
export declare const METADATA_KEY: {
    controller: string;
    httpMethod: string;
};
export interface HonoControllerMetadata {
    path: string;
    middleware?: MiddlewareHandler[];
}
