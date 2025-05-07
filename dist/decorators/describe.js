/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
const endpointDescriptions = [];
export function describe(info) {
    return function (target, propertyKey, descriptor) {
        const category = target.constructor.name;
        endpointDescriptions.push({ category, ...info });
    };
}
export function getAllDescriptions() {
    return endpointDescriptions;
}
