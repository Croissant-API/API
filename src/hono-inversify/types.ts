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

export const TYPE = {
  HonoRequestHandler: Symbol.for('HonoRequestHandler'),
};

export const METADATA_KEY = {
  controller: 'hono-inversify:controller',
  httpMethod: 'hono-inversify:httpMethod',
};

export interface HonoControllerMetadata {
  path: string;
  middleware?: MiddlewareHandler[];
}