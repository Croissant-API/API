import { app } from "./app";

import fs from "fs";
import path from "path";

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
  const cwd = process.cwd();
  const dbPath = path.join(cwd, "database.db");
  const backupDir = path.join(cwd, "database_backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, `database_${getTimestamp()}.db`);
  fs.copyFile(dbPath, backupPath, (err) => {
    if (err) {
      console.error("Database backup failed:", err);
    } else {
      console.log("Database backup created:", backupPath);
    }
  });
}

// Backup at startup
backupDatabase();

// Backup every hour
setInterval(backupDatabase, 60 * 60 * 1000);
