"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpAll = exports.httpHead = exports.httpDelete = exports.httpPatch = exports.httpPut = exports.httpPost = exports.httpGet = exports.controller = exports.getControllerRegistry = void 0;
require("reflect-metadata");
const types_1 = require("./types");
// Registry to store all controller constructors
const controllerRegistry = new Set();
// Export function to get the registry
function getControllerRegistry() {
    return controllerRegistry;
}
exports.getControllerRegistry = getControllerRegistry;
function controller(path, ...middleware) {
    return function (target) {
        const metadata = {
            path: path || '',
            middleware
        };
        Reflect.defineMetadata(types_1.METADATA_KEY.controller, metadata, target);
        // Add to registry
        controllerRegistry.add(target);
        console.log(`Registered controller: ${target.name} with path: ${metadata.path}`);
        return target;
    };
}
exports.controller = controller;
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
        const metadataList = Reflect.getMetadata(types_1.METADATA_KEY.httpMethod, target.constructor) || [];
        metadataList.push(metadata);
        Reflect.defineMetadata(types_1.METADATA_KEY.httpMethod, metadataList, target.constructor);
        return descriptor;
    };
}
function httpGet(path, ...middleware) {
    return httpMethod('GET', path, ...middleware);
}
exports.httpGet = httpGet;
function httpPost(path, ...middleware) {
    return httpMethod('POST', path, ...middleware);
}
exports.httpPost = httpPost;
function httpPut(path, ...middleware) {
    return httpMethod('PUT', path, ...middleware);
}
exports.httpPut = httpPut;
function httpPatch(path, ...middleware) {
    return httpMethod('PATCH', path, ...middleware);
}
exports.httpPatch = httpPatch;
function httpDelete(path, ...middleware) {
    return httpMethod('DELETE', path, ...middleware);
}
exports.httpDelete = httpDelete;
function httpHead(path, ...middleware) {
    return httpMethod('HEAD', path, ...middleware);
}
exports.httpHead = httpHead;
function httpAll(path, ...middleware) {
    return httpMethod('ALL', path, ...middleware);
}
exports.httpAll = httpAll;
