import { httpRequestDurationMicroseconds } from "../config/metrics";
import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

/**
 * Middleware pour logger toutes les requêtes entrantes
 * - Méthode HTTP
 * - URL
 * - Statut HTTP de réponse
 * - Temps d'exécution
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    end({ method: req.method, route: req.route?.path || req.originalUrl, status_code: res.statusCode });

    logger.http("HTTP Request", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip
    });
  });

  next();
};