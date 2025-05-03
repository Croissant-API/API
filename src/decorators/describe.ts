/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
const endpointDescriptions: any[] = [];

export function describe(info: {
    endpoint: string,
    method: string,
    description: string,
    params?: any,
    body?: any,
    query?: any,
    responseType?: string,
    exampleResponse?: any,
    example?: string
}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        endpointDescriptions.push(info);
    };
}

export function getAllDescriptions() {
    return endpointDescriptions;
}