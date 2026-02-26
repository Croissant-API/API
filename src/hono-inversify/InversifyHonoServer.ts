import { Context, Hono, MiddlewareHandler } from 'hono';
import { Container } from 'inversify';
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
    console.log(`Registering ${registry.size} controllers from registry`);
    registry.forEach((controllerConstructor) => {
      const metadata = Reflect.getMetadata(METADATA_KEY.controller, controllerConstructor);
    
      if (!metadata) {
        console.warn(`No controller metadata found for ${controllerConstructor.name}`);
        return;
      }

      // Get controller instance from container - FIX: Ensure proper binding
      let controllerInstance: object;
      try {
        // Check if the controller is bound in the container
        if (this._container.isBound(controllerConstructor)) {
          controllerInstance = this._container.get<object>(controllerConstructor);
        } else {
          console.error(`Controller ${controllerConstructor.name} is not bound to the container`);
          return;
        }
      } catch (error) {
        console.error(`Error getting controller instance for ${controllerConstructor.name}:`, error);
        return;
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

    console.log(`Registering controller: ${controllerInstance.constructor.name}`);

    console.log(`Registering controller with ${handlerMetadatas.length} handlers`);

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

    // Ensure path starts with / and remove trailing /
    if (path && !path.startsWith('/')) {
      path = '/' + path;
    }
    if (!path) {
      path = '/';
    }
    // Remove trailing slash unless it's the root path
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // Create the handler wrapper
    const handler: MiddlewareHandler = async (c: Context) => {
      try {
        const method = (controllerInstance as Record<string, unknown>)[handlerMetadata.key];
        if (typeof method === 'function') {
          const result = await method.call(controllerInstance, c);
          return result;
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
        this._app.get(path as any, ...middlewares);
        break;
      case 'post':
        this._app.post(path as any, ...middlewares);
        break;
      case 'put':
        this._app.put(path as any, ...middlewares);
        break;
      case 'patch':
        this._app.patch(path as any, ...middlewares);
        break;
      case 'delete':
        this._app.delete(path as any, ...middlewares);
        break;
      case 'head':
        this._app.on('HEAD', path as any, ...middlewares);
        break;
      case 'all':
        this._app.all(path as any, ...middlewares);
        break;
      default:
        console.warn(`Unsupported HTTP method: ${method}`);
    }

    console.log(`Registered ${method.toUpperCase()} ${path} -> ${controllerInstance.constructor.name}.${handlerMetadata.key}`);
  }

  private getHandlersFromMetadata(constructor: object): HonoHandlerDecorator[] {
    const handlerMetadatas: HonoHandlerDecorator[] = 
      Reflect.getMetadata(METADATA_KEY.httpMethod, constructor) || [];
    
    return handlerMetadatas;
  }
}