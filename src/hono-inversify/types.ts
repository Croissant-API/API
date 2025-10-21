import { Context, MiddlewareHandler } from 'hono';

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

export interface HonoControllerMetadata {
  path?: string;
  middleware?: MiddlewareHandler[];
  target: object;
}

export interface HonoRequestHandler {
  (context: Context): Promise<Response | HonoHandlerResult | void>;
}

export const TYPE = {
  HonoRequestHandler: Symbol.for('HonoRequestHandler'),
};

export const METADATA_KEY = {
  controller: '_controller',
  httpMethod: '_httpMethod',
  httpGet: '_httpGet',
  httpPost: '_httpPost',
  httpPut: '_httpPut',
  httpPatch: '_httpPatch',
  httpHead: '_httpHead',
  httpDelete: '_httpDelete',
  httpAll: '_httpAll',
  middleware: '_middleware',
  param: '_param',
};