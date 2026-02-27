import 'reflect-metadata';
import { METADATA_KEY } from './types';
// Registry to store all controller constructors
const controllerRegistry = new Set();
// Export function to get the registry
export function getControllerRegistry() {
    return controllerRegistry;
}
export function controller(path, ...middleware) {
    return function (target) {
        const metadata = {
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
function httpMethod(method, path, ...middleware) {
    return function (target, key, descriptor) {
        const metadata = {
            key,
            method: method.toUpperCase(),
            path: path || '',
            middleware,
            target,
            descriptor
        };
        const metadataList = Reflect.getMetadata(METADATA_KEY.httpMethod, target.constructor) || [];
        metadataList.push(metadata);
        Reflect.defineMetadata(METADATA_KEY.httpMethod, metadataList, target.constructor);
        return descriptor;
    };
}
export function httpGet(path, ...middleware) {
    return httpMethod('GET', path, ...middleware);
}
export function httpPost(path, ...middleware) {
    return httpMethod('POST', path, ...middleware);
}
export function httpPut(path, ...middleware) {
    return httpMethod('PUT', path, ...middleware);
}
export function httpPatch(path, ...middleware) {
    return httpMethod('PATCH', path, ...middleware);
}
export function httpDelete(path, ...middleware) {
    return httpMethod('DELETE', path, ...middleware);
}
export function httpHead(path, ...middleware) {
    return httpMethod('HEAD', path, ...middleware);
}
export function httpAll(path, ...middleware) {
    return httpMethod('ALL', path, ...middleware);
}
