"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllDescriptions = exports.describe = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
const endpointDescriptions = [];
function describe(info) {
    return function (target, propertyKey, descriptor) {
        const category = target.constructor.name;
        endpointDescriptions.push({ category, ...info });
    };
}
exports.describe = describe;
function getAllDescriptions() {
    return endpointDescriptions;
}
exports.getAllDescriptions = getAllDescriptions;
