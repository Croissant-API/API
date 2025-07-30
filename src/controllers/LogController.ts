import { Response } from "express";
import { inject } from "inversify";
import { controller, httpGet } from "inversify-express-utils";
import { ILogService } from "../services/LogService";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { describe } from "../decorators/describe";

function handleError(res: Response, error: unknown, message: string, status = 500) {
  const msg = error instanceof Error ? error.message : String(error);
  res.status(status).send({ message, error: msg });
}

@controller("/logs")
export class LogController {
  constructor(@inject("LogService") private logService: ILogService) {}

  @describe({
    endpoint: "/logs",
    method: "GET",
    description: "Get all logs with pagination",
    query: { 
      limit: "Number of logs to return (default: 100)",
      offset: "Number of logs to skip (default: 0)"
    },
    responseType: [{
      id: "number",
      timestamp: "string",
      ip_address: "string",
      table_name: "string",
      controller: "string",
      original_path: "string",
      http_method: "string",
      request_body: "string",
      user_id: "string",
      status_code: "number"
    }],
    example: "GET /api/logs?limit=50&offset=0",
    requiresAuth: true
  })
  @httpGet("/", LoggedCheck.middleware)
  public async getAllLogs(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: "Admin access required" });
    }

    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const logs = await this.logService.getLogs(limit, offset);
      res.send(logs);
    } catch (error) {
      handleError(res, error, "Error fetching logs");
    }
  }

  @describe({
    endpoint: "/logs/controller/:controller",
    method: "GET",
    description: "Get logs for a specific controller",
    params: { controller: "The name of the controller" },
    query: { limit: "Number of logs to return (default: 100)" },
    responseType: [{
      id: "number",
      timestamp: "string",
      ip_address: "string",
      table_name: "string",
      controller: "string",
      original_path: "string",
      http_method: "string",
      request_body: "string",
      user_id: "string",
      status_code: "number"
    }],
    example: "GET /api/logs/controller/users?limit=50",
    requiresAuth: true
  })
  @httpGet("/controller/:controller", LoggedCheck.middleware)
  public async getLogsByController(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: "Admin access required" });
    }

    try {
      const controller = req.params.controller;
      const limit = parseInt(req.query.limit as string) || 100;
      
      const logs = await this.logService.getLogsByController(controller, limit);
      res.send(logs);
    } catch (error) {
      handleError(res, error, "Error fetching logs by controller");
    }
  }

  @describe({
    endpoint: "/logs/user/:userId",
    method: "GET",
    description: "Get logs for a specific user",
    params: { userId: "The ID of the user" },
    query: { limit: "Number of logs to return (default: 100)" },
    responseType: [{
      id: "number",
      timestamp: "string",
      ip_address: "string",
      table_name: "string",
      controller: "string",
      original_path: "string",
      http_method: "string",
      request_body: "string",
      user_id: "string",
      status_code: "number"
    }],
    example: "GET /api/logs/user/123?limit=50",
    requiresAuth: true
  })
  @httpGet("/user/:userId", LoggedCheck.middleware)
  public async getLogsByUser(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: "Admin access required" });
    }

    try {
      const userId = req.params.userId;
      const limit = parseInt(req.query.limit as string) || 100;
      
      const logs = await this.logService.getLogsByUser(userId, limit);
      res.send(logs);
    } catch (error) {
      handleError(res, error, "Error fetching logs by user");
    }
  }

  @describe({
    endpoint: "/logs/table/:tableName",
    method: "GET",
    description: "Get logs for a specific table",
    params: { tableName: "The name of the table" },
    query: { limit: "Number of logs to return (default: 100)" },
    responseType: [{
      id: "number",
      timestamp: "string",
      ip_address: "string",
      table_name: "string",
      controller: "string",
      original_path: "string",
      http_method: "string",
      request_body: "string",
      user_id: "string",
      status_code: "number"
    }],
    example: "GET /api/logs/table/users?limit=50",
    requiresAuth: true
  })
  @httpGet("/table/:tableName", LoggedCheck.middleware)
  public async getLogsByTable(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: "Admin access required" });
    }

    try {
      const tableName = req.params.tableName;
      const limit = parseInt(req.query.limit as string) || 100;
      
      const logs = await this.logService.getLogsByTable(tableName, limit);
      res.send(logs);
    } catch (error) {
      handleError(res, error, "Error fetching logs by table");
    }
  }

  @describe({
    endpoint: "/logs/stats",
    method: "GET",
    description: "Get logging statistics",
    responseType: {
      totalLogs: "number",
      logsByController: [{
        controller: "string",
        count: "number"
      }],
      logsByTable: [{
        table_name: "string", 
        count: "number"
      }]
    },
    example: "GET /api/logs/stats",
    requiresAuth: true
  })
  @httpGet("/stats", LoggedCheck.middleware)
  public async getLogStats(req: AuthenticatedRequest, res: Response) {
    if (!req.user?.admin) {
      return res.status(403).send({ message: "Admin access required" });
    }

    try {
      const stats = await this.logService.getLogStats();
      res.send(stats);
    } catch (error) {
      handleError(res, error, "Error fetching log statistics");
    }
  }

  @describe({
    endpoint: "/logs/@me",
    method: "GET",
    description: "Get logs for the authenticated user",
    query: { limit: "Number of logs to return (default: 100)" },
    responseType: [{
      id: "number",
      timestamp: "string",
      ip_address: "string",
      table_name: "string",
      controller: "string",
      original_path: "string",
      http_method: "string",
      request_body: "string",
      user_id: "string",
      status_code: "number"
    }],
    example: "GET /api/logs/@me?limit=50",
    requiresAuth: true
  })
  @httpGet("/@me", LoggedCheck.middleware)
  public async getMyLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      
      const logs = await this.logService.getLogsByUser(req.user.user_id, limit);
      res.send(logs);
    } catch (error) {
      handleError(res, error, "Error fetching user logs");
    }
  }
}
