import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";

import router from "./routes";
import { logger } from "./lib/logger";
import { connectMongo } from "./lib/mongodb";

const app: Express = express();

/**
 * Generate Request ID
 */
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as any).id = randomUUID();
  next();
});

/**
 * Logger
 */
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as any).id,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  }),
);

/**
 * Security
 */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

/**
 * CORS
 */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  }),
);

/**
 * Body Parsers
 */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/**
 * Sessions
 */
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      secure: process.env.NODE_ENV === "production",

      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",

      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

/**
 * MongoDB
 */
connectMongo().catch((err) => {
  logger.error(
    { err },
    "MongoDB connection failed — check MONGO_URL environment variable",
  );
});

/**
 * API Routes
 */
app.use("/api", router);

/**
 * Global Error Handler
 */
app.use(
  (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    logger.error(
      {
        err,
        reqId: (req as any).id,
      },
      "Unhandled error",
    );

    res.status(500).json({
      error: "Internal server error",
    });
  },
);

export default app;