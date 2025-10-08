const endpointDescriptions: any[] = [];

export function describe(info: { endpoint: string; method: string; description: string; params?: any; body?: any; query?: any; responseType?: object; exampleResponse?: any; example?: string; requiresAuth?: boolean }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const category = target.constructor.name;
    endpointDescriptions.push({ category, ...info });
  };
}

export function getAllDescriptions() {
  return endpointDescriptions;
}
