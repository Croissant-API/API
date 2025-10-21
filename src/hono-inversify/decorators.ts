import { MiddlewareHandler } from 'hono';
import 'reflect-metadata';
import { HonoControllerMetadata, HonoHandlerDecorator, METADATA_KEY } from './types';

// Registry for controllers - avoiding circular imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let controllerRegistry: Set<new (...args: any[]) => object> | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getControllerRegistry = (): Set<new (...args: any[]) => object> => {
  if (!controllerRegistry) {
    controllerRegistry = new Set();
  }
  return controllerRegistry;
};

export const controller = (path?: string, ...middleware: MiddlewareHandler[]) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <T extends new (...args: any[]) => object>(target: T): T => {
    const currentMetadata: HonoControllerMetadata = {
      path,
      middleware,
      target,
    };

    Reflect.defineMetadata(METADATA_KEY.controller, currentMetadata, target);
    
    // Ensure the target is bound to the container
    const previousMetadata = Reflect.getMetadata('inversify:tagged_props', target) || {};
    Reflect.defineMetadata('inversify:tagged_props', previousMetadata, target);

    // Auto-register the controller
    getControllerRegistry().add(target);

    return target;
  };
};

const httpMethodDecorator = (method: string, path?: string, ...middleware: MiddlewareHandler[]) => {
  return (target: object, key: string, descriptor: PropertyDescriptor) => {
    const handlerDecorator: HonoHandlerDecorator = {
      path,
      method,
      middleware,
      target,
      key,
      descriptor,
    };

    let metadataList: HonoHandlerDecorator[] = [];
    
    if (!Reflect.hasMetadata(METADATA_KEY.httpMethod, target.constructor)) {
      Reflect.defineMetadata(METADATA_KEY.httpMethod, metadataList, target.constructor);
    } else {
      metadataList = Reflect.getMetadata(METADATA_KEY.httpMethod, target.constructor);
    }

    metadataList.push(handlerDecorator);
  };
};

export const httpGet = (path?: string, ...middleware: MiddlewareHandler[]) => 
  httpMethodDecorator('get', path, ...middleware);

export const httpPost = (path?: string, ...middleware: MiddlewareHandler[]) => 
  httpMethodDecorator('post', path, ...middleware);

export const httpPut = (path?: string, ...middleware: MiddlewareHandler[]) => 
  httpMethodDecorator('put', path, ...middleware);

export const httpPatch = (path?: string, ...middleware: MiddlewareHandler[]) => 
  httpMethodDecorator('patch', path, ...middleware);

export const httpDelete = (path?: string, ...middleware: MiddlewareHandler[]) => 
  httpMethodDecorator('delete', path, ...middleware);

export const httpHead = (path?: string, ...middleware: MiddlewareHandler[]) => 
  httpMethodDecorator('head', path, ...middleware);

export const httpAll = (path?: string, ...middleware: MiddlewareHandler[]) => 
  httpMethodDecorator('all', path, ...middleware);