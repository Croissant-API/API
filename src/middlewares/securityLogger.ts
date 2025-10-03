import { logger } from "../config/logger";
import { catchSync } from "./catchError";

/**
 * Middleware de logging des événements sensibles de sécurité
 * - Tentatives de login échouées
 * - Accès refusés (403)
 * - Rate-limit trigger
 */
export const securityLogger = catchSync((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode === 403) {
      logger.warn("Access Denied", {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        user: req.user?.id || null
      });
    }

    if (res.statusCode === 401) {
      logger.warn("Unauthorized access attempt", {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip
      });
    }
  });
  next();
})