import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Startup env-var presence check — values are never logged, only which keys exist
const criticalVars = ["MONGO_URL", "DB_NAME", "SESSION_SECRET", "GEMINI_API_KEY", "STORAGE_PROVIDER"];
const envReport: Record<string, string> = {};
for (const key of criticalVars) {
  envReport[key] = process.env[key] ? "SET" : "MISSING";
}
logger.info({ env: envReport }, "Startup env-var check");

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
