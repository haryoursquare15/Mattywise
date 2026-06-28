import { type Request, type Response, type NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const skip =
    req.path === "/healthz" ||
    req.path.startsWith("/auth/");

  if (skip) return next();

  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
