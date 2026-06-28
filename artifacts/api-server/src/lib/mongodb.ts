import mongoose from "mongoose";
import { logger } from "./logger";

let connected = false;
let available = false;

export function isMongoAvailable(): boolean {
  return available;
}

export async function connectMongo(): Promise<void> {
  if (connected) return;

  const uri = process.env["MONGODB_URI"];
  if (!uri) {
    logger.warn(
      "MONGODB_URI is not set — document, report, conversation and search routes will return 503. " +
      "Add MONGODB_URI in Railway → your service → Variables tab, then redeploy.",
    );
    return;
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  connected = true;
  available = true;
  logger.info("MongoDB connected");
}

export { mongoose };
