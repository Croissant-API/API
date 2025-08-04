"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const socketServer_1 = require("./socketServer");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const port = process.env.PORT || 3456;
// Configurer Socket.IO avec l'app Express
const { server } = (0, socketServer_1.setupSocketIO)(app_1.app);
// Démarrer le serveur avec Socket.IO intégré
server.listen(port, () => {
    console.log(`API Server with Socket.IO started on port ${port}`);
});
function getTimestamp() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}
function backupDatabase() {
    const cwd = process.cwd();
    const dbPath = path_1.default.join(cwd, "database.db");
    const backupDir = path_1.default.join(cwd, "database_backups");
    if (!fs_1.default.existsSync(backupDir)) {
        fs_1.default.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path_1.default.join(backupDir, `database_${getTimestamp()}.db`);
    fs_1.default.copyFile(dbPath, backupPath, (err) => {
        if (err) {
            console.error("Database backup failed:", err);
        }
        else {
            console.log("Database backup created:", backupPath);
        }
    });
}
// Backup at startup
backupDatabase();
// Backup every hour
setInterval(backupDatabase, 60 * 60 * 1000);
