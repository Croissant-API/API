"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const port = process.env.PORT || 3000;
app_1.app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
function getTimestamp() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}
function backupDatabase() {
    const timestamp = getTimestamp();
    const backupDir = path_1.default.join(process.cwd(), "database_backups");
    const backupPath = path_1.default.join(backupDir, `mysql_backup_${timestamp}.sql`);
    if (!fs_1.default.existsSync(backupDir)) {
        fs_1.default.mkdirSync(backupDir, { recursive: true });
    }
    const dbUser = process.env.DB_USER;
    const dbPassword = process.env.DB_PASS;
    const dbName = process.env.DB_NAME;
    const dbHost = process.env.DB_HOST;
    if (!dbUser || !dbPassword || !dbName || !dbHost) {
        console.error("Missing database credentials in environment variables.");
        return;
    }
    const command = `mysqldump -h ${dbHost} -u ${dbUser} -p'${dbPassword}' ${dbName} > ${backupPath}`;
    (0, child_process_1.exec)(command, (error) => {
        if (!error) {
            console.log("MySQL database backup created:", backupPath);
        }
    });
}
// Backup at startup
backupDatabase();
// Backup every hour
setInterval(backupDatabase, 60 * 60 * 1000);
