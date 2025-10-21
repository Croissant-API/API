import { Context, Hono, MiddlewareHandler } from 'hono';
import { Container } from 'inversify';
import 'reflect-metadata';
import { getControllerRegistry } from './decorators';
import { HonoControllerMetadata, HonoHandlerDecorator, METADATA_KEY } from './types';

export class InversifyHonoServer {
  private _container: Container;
  private _app: Hono;
  private _configFn?: (app: Hono) => void;
  private _errorConfigFn?: (app: Hono) => void;

  constructor(container: Container) {
    this._container = container;
    this._app = new Hono();
  }

  public setConfig(fn: (app: Hono) => void): InversifyHonoServer {
    this._configFn = fn;
    return this;
  }

  public setErrorConfig(fn: (app: Hono) => void): InversifyHonoServer {
    this._errorConfigFn = fn;
    return this;
  }

  public build(): Hono {
    // Apply config first
    if (this._configFn) {
      this._configFn(this._app);
    }

    // Register all controllers
    this.registerControllers();

    // Apply error config last
    if (this._errorConfigFn) {
      this._errorConfigFn(this._app);
    }

    return this._app;
  }

  private registerControllers(): void {
    const registry = getControllerRegistry();
    registry.forEach((controllerConstructor) => {
      const metadata = Reflect.getMetadata(METADATA_KEY.controller, controllerConstructor);
      if (!metadata) return;

      // Get controller instance from container
      let controllerInstance: object;
      try {
        controllerInstance = this._container.get<object>(controllerConstructor);
      } catch {
        // If not bound to container, create instance directly
        controllerInstance = new controllerConstructor();
      }

      this.registerController(controllerInstance, metadata);
    });
  }

  private registerController(
    controllerInstance: object,
    controllerMetadata: HonoControllerMetadata
  ): void {
    const handlerMetadatas: HonoHandlerDecorator[] = this.getHandlersFromMetadata(
      controllerInstance.constructor
    );

    // Register each method as a route
    handlerMetadatas.forEach((handlerMetadata) => {
      this.registerHandler(
        controllerInstance,
        controllerMetadata,
        handlerMetadata
      );
    });
  }

  private registerHandler(
    controllerInstance: object,
    controllerMetadata: HonoControllerMetadata,
    handlerMetadata: HonoHandlerDecorator
  ): void {
    // Build the full path
    let path = '';
    if (controllerMetadata.path) {
      path += controllerMetadata.path;
    }
    if (handlerMetadata.path) {
      path += handlerMetadata.path;
    }

    // Ensure path starts with /
    if (path && !path.startsWith('/')) {
      path = '/' + path;
    }
    if (!path) {
      path = '/';
    }

    // Create the handler wrapper
    const handler: MiddlewareHandler = async (c: Context) => {
      try {
        const method = (controllerInstance as Record<string, unknown>)[handlerMetadata.key];
        if (typeof method === 'function') {
          const result = await method.call(controllerInstance, c);
          
          // If result is already a Response, return it
          if (result instanceof Response) {
            return result;
          }
          
          // If result is an object, return as JSON
          if (typeof result === 'object' && result !== null) {
            return c.json(result);
          }
          
          // If result is a primitive, return as text
          if (result !== undefined) {
            return c.text(String(result));
          }
          
          // If no result, assume the handler handled the response manually
          return;
        }
        
        throw new Error(`Method ${handlerMetadata.key} not found on controller`);
      } catch (error) {
        console.error('Handler error:', error);
        return c.json({ error: 'Internal server error' }, 500);
      }
    };

    // Combine middlewares: controller middleware + method middleware
    const middlewares: MiddlewareHandler[] = [];
    if (controllerMetadata.middleware) {
      middlewares.push(...controllerMetadata.middleware);
    }
    if (handlerMetadata.middleware) {
      middlewares.push(...handlerMetadata.middleware);
    }
    middlewares.push(handler);

    // Register the route
    const method = handlerMetadata.method.toLowerCase();
    switch (method) {
      case 'get':
        this._app.get(path, ...middlewares);
        break;
      case 'post':
        this._app.post(path, ...middlewares);
        break;
      case 'put':
        this._app.put(path, ...middlewares);
        break;
      case 'patch':
        this._app.patch(path, ...middlewares);
        break;
      case 'delete':
        this._app.delete(path, ...middlewares);
        break;
      case 'head':
        // Hono doesn't have head method, use on instead
        this._app.on('HEAD', path, ...middlewares);
        break;
      case 'all':
        this._app.all(path, ...middlewares);
        break;
      default:
        console.warn(`Unsupported HTTP method: ${method}`);
    }
  }



  private getHandlersFromMetadata(constructor: object): HonoHandlerDecorator[] {
    const handlerMetadatas: HonoHandlerDecorator[] = 
      Reflect.getMetadata(METADATA_KEY.httpMethod, constructor) || [];
    
    return handlerMetadatas;
  }
}