import { app } from "./app";
// import { logger } from "./services/logger";

import "./config/envVerifications";
import './job/backupDatabase';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});