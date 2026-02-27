import { Context } from 'hono';
import { ILogService } from '../services/LogService';
import { IStudioService } from '../services/StudioService';
export declare class Studios {
    private studioService;
    private logService;
    constructor(studioService: IStudioService, logService: ILogService);
    private sendError;
    private createLog;
    private getUserFromContext;
    private getStudioOrError;
    createStudio(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
    getStudio(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
    getMyStudios(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
    private checkStudioAdmin;
    addUserToStudio(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
    removeUserFromStudio(c: Context): Promise<Response & import("hono").TypedResponse<any, any, "json">>;
}
