import { type Request, type Response, type NextFunction } from "express";
import { isMongoAvailable } from "../lib/mongodb";

export function requireMongo(_req: Request, res: Response, next: NextFunction) {
  if (!isMongoAvailable()) {
    res.status(503).json({
      error: "Database not configured",
      detail: "Add MONGODB_URI in Railway → your service → Variables tab, then redeploy.",
    });
    return;
  }
  next();
}
