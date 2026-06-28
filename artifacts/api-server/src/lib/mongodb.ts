import mongoose from "mongoose";
import { logger } from "./logger";

let connected = false;
let available = false;

export function isMongoAvailable(): boolean {
  return available;
}

export async function connectMongo(): Promise<void> {
  if (connected) return;

  const url = process.env["MONGO_URL"];
  const dbName = process.env["DB_NAME"] ?? "mattywise";

  if (!url) {
    logger.warn(
      "MONGO_URL is not set — document, report, conversation and search routes will return 503. " +
      "Set MONGO_URL (and optionally DB_NAME) as environment variables.",
    );
    return;
  }

  await mongoose.connect(url, { dbName, serverSelectionTimeoutMS: 10000 });
  connected = true;
  available = true;
  logger.info({ dbName }, "MongoDB connected");
}

export { mongoose };
