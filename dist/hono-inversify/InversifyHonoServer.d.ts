import { Hono } from 'hono';
import { Container } from 'inversify';
export declare class InversifyHonoServer {
    private _container;
    private _app;
    private _configFn?;
    private _errorConfigFn?;
    constructor(container: Container);
    setConfig(fn: (app: Hono) => void): InversifyHonoServer;
    setErrorConfig(fn: (app: Hono) => void): InversifyHonoServer;
    build(): Hono;
    private registerControllers;
    private registerController;
    private registerHandler;
    private getHandlersFromMetadata;
}
