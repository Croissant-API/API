"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InversifyHonoServer = void 0;
const hono_1 = require("hono");
const decorators_1 = require("./decorators");
const types_1 = require("./types");
class InversifyHonoServer {
    constructor(container) {
        this._container = container;
        this._app = new hono_1.Hono();
    }
    setConfig(fn) {
        this._configFn = fn;
        return this;
    }
    setErrorConfig(fn) {
        this._errorConfigFn = fn;
        return this;
    }
    build() {
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
    registerControllers() {
        const registry = (0, decorators_1.getControllerRegistry)();
        console.log(`Registering ${registry.size} controllers from registry`);
        registry.forEach((controllerConstructor) => {
            const metadata = Reflect.getMetadata(types_1.METADATA_KEY.controller, controllerConstructor);
            if (!metadata) {
                console.warn(`No controller metadata found for ${controllerConstructor.name}`);
                return;
            }
            // Get controller instance from container - FIX: Ensure proper binding
            let controllerInstance;
            try {
                // Check if the controller is bound in the container
                if (this._container.isBound(controllerConstructor)) {
                    controllerInstance = this._container.get(controllerConstructor);
                }
                else {
                    console.error(`Controller ${controllerConstructor.name} is not bound to the container`);
                    return;
                }
            }
            catch (error) {
                console.error(`Error getting controller instance for ${controllerConstructor.name}:`, error);
                return;
            }
            this.registerController(controllerInstance, metadata);
        });
    }
    registerController(controllerInstance, controllerMetadata) {
        const handlerMetadatas = this.getHandlersFromMetadata(controllerInstance.constructor);
        console.log(`Registering controller: ${controllerInstance.constructor.name}`);
        console.log(`Registering controller with ${handlerMetadatas.length} handlers`);
        // Register each method as a route
        handlerMetadatas.forEach((handlerMetadata) => {
            this.registerHandler(controllerInstance, controllerMetadata, handlerMetadata);
        });
    }
    registerHandler(controllerInstance, controllerMetadata, handlerMetadata) {
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
        const handler = async (c) => {
            try {
                const method = controllerInstance[handlerMetadata.key];
                if (typeof method === 'function') {
                    const result = await method.call(controllerInstance, c);
                    return result;
                }
                throw new Error(`Method ${handlerMetadata.key} not found on controller`);
            }
            catch (error) {
                console.error('Handler error:', error);
                return c.json({ error: 'Internal server error' }, 500);
            }
        };
        // Combine middlewares: controller middleware + method middleware
        const middlewares = [];
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
                this._app.on('HEAD', path, ...middlewares);
                break;
            case 'all':
                this._app.all(path, ...middlewares);
                break;
            default:
                console.warn(`Unsupported HTTP method: ${method}`);
        }
        console.log(`Registered ${method.toUpperCase()} ${path} -> ${controllerInstance.constructor.name}.${handlerMetadata.key}`);
    }
    getHandlersFromMetadata(constructor) {
        const handlerMetadatas = Reflect.getMetadata(types_1.METADATA_KEY.httpMethod, constructor) || [];
        return handlerMetadatas;
    }
}
exports.InversifyHonoServer = InversifyHonoServer;
