import mongoose from "mongoose";
import { logger } from "./logger";

let connected = false;

export async function connectMongo(): Promise<void> {
  if (connected) return;

  const uri = process.env["MONGODB_URI"];
  if (!uri) {
    throw new Error(
      "MONGODB_URI environment variable is required. Add your MongoDB connection string in the Secrets tab.",
    );
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  connected = true;
  logger.info("MongoDB connected");
}

export { mongoose };
