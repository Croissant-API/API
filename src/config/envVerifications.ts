const port = process.env.PORT;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASS;
const dbName = process.env.DB_NAME;
const dbHost = process.env.DB_HOST;

if(!port) {
  throw new Error("PORT in't defined in env file.");
}
if(!dbUser) {
  throw new Error("DB_USER in't defined in env file.");
}
if(!dbPassword) {
  throw new Error("DB_PASS in't defined in env file.");
}
if(!dbName) {
  throw new Error("DB_NAME in't defined in env file.");
}
if(!dbHost) {
  throw new Error("DB_HOST in't defined in env file.");
}