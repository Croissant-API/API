import { app } from "./app";

import fs from "fs";
import path from "path";
import { exec } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

function getTimestamp() {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function backupDatabase() {
  const timestamp = getTimestamp();
  const backupDir = path.join(process.cwd(), "database_backups");
  const backupPath = path.join(backupDir, `mysql_backup_${timestamp}.sql`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
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

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error("MySQL database backup failed:", error);
      console.error("stderr:", stderr);
    } else {
      console.log("MySQL database backup created:", backupPath);
    }
  });
}

// Backup at startup
backupDatabase();

// Backup every hour
setInterval(backupDatabase, 60 * 60 * 1000);