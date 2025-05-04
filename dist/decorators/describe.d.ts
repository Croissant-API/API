export declare function describe(info: {
    endpoint: string;
    method: string;
    description: string;
    params?: any;
    body?: any;
    query?: any;
    responseType?: string;
    exampleResponse?: any;
    example?: string;
}): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export declare function getAllDescriptions(): any[];
