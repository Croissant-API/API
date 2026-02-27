/* eslint-disable @typescript-eslint/no-explicit-any */
import { MiddlewareHandler } from 'hono';
import 'reflect-metadata';
import { HonoControllerMetadata, HonoHandlerDecorator, METADATA_KEY } from './types';

// Registry to store all controller constructors
const controllerRegistry = new Set<any>();

// Export function to get the registry
export function getControllerRegistry(): Set<any> {
  return controllerRegistry;
}

export function controller(path?: string, ...middleware: MiddlewareHandler[]) {
  return function <T extends { new (...args: any[]): object }>(target: T) {
    const metadata: HonoControllerMetadata = {
      path: path || '',
      middleware
    };
    
    Reflect.defineMetadata(METADATA_KEY.controller, metadata, target);
    
    // Add to registry
    controllerRegistry.add(target);
    // console.log(`Registered controller: ${target.name} with path: ${metadata.path}`);
    
    return target;
  };
}

function httpMethod(method: string, path?: string, ...middleware: MiddlewareHandler[]) {
  return function (target: any, key: string, descriptor: PropertyDescriptor) {
    const metadata: HonoHandlerDecorator = {
      key,
      method: method.toUpperCase(),
      path: path || '',
      middleware,
      target,
      descriptor
    };

    const metadataList: HonoHandlerDecorator[] = 
      Reflect.getMetadata(METADATA_KEY.httpMethod, target.constructor) || [];
    
    metadataList.push(metadata);
    
    Reflect.defineMetadata(METADATA_KEY.httpMethod, metadataList, target.constructor);
    
    return descriptor;
  };
}

export function httpGet(path?: string, ...middleware: MiddlewareHandler[]) {
  return httpMethod('GET', path, ...middleware);
}

export function httpPost(path?: string, ...middleware: MiddlewareHandler[]) {
  return httpMethod('POST', path, ...middleware);
}

export function httpPut(path?: string, ...middleware: MiddlewareHandler[]) {
  return httpMethod('PUT', path, ...middleware);
}

export function httpPatch(path?: string, ...middleware: MiddlewareHandler[]) {
  return httpMethod('PATCH', path, ...middleware);
}

export function httpDelete(path?: string, ...middleware: MiddlewareHandler[]) {
  return httpMethod('DELETE', path, ...middleware);
}

export function httpHead(path?: string, ...middleware: MiddlewareHandler[]) {
  return httpMethod('HEAD', path, ...middleware);
}

export function httpAll(path?: string, ...middleware: MiddlewareHandler[]) {
  return httpMethod('ALL', path, ...middleware);
}