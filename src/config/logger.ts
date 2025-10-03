import winston from "winston";
import path from "path";

import DailyRotateFile from "winston-daily-rotate-file";

// Configuration centrale de Winston pour logger les événements application et erreurs
const logDir = path.join(__dirname, "../../logs");

export const logger = winston.createLogger({
  level: `${process.env.NODE_ENV}`.toLocaleLowerCase() === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      level : 'info', 
      format: winston
        .format
        .printf(info => `[${info.level.toUpperCase()}] ${info.message}`)
    }),
    new DailyRotateFile({ 
      filename: path.join(logDir, "%DATE%.error.log"), 
      level: "error",
      maxFiles: 7, 

    }),
    new DailyRotateFile({ 
      filename: path.join(logDir, "%DATE%.combined.log"),
      maxFiles: 7, 
    }),
  ],
  exceptionHandlers: [
    new DailyRotateFile({ 
      filename: path.join(logDir, "%DATE%.exceptions.log"),  
      maxFiles: 7, 
    })
  ]
});