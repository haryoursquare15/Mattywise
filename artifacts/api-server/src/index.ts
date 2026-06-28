import { Router, type IRouter } from "express";

import { requireMongo } from "../middlewares/requireMongo";
import { requireAuth } from "../middlewares/requireAuth";

import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import documentsRouter from "./documents";
import reportsRouter from "./reports";
import conversationsRouter from "./conversations";
import dashboardRouter from "./dashboard";
import searchRouter from "./search";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

/**
 * -------------------------------------------------------
 * Public Routes
 * -------------------------------------------------------
 * These routes DO NOT require authentication.
 */

router.use(authRouter);
router.use(healthRouter);
router.use(storageRouter);

/**
 * -------------------------------------------------------
 * Protected Routes
 * -------------------------------------------------------
 */

router.use(requireMongo);
router.use(requireAuth);

router.use(documentsRouter);
router.use(reportsRouter);
router.use(conversationsRouter);
router.use(dashboardRouter);
router.use(searchRouter);
router.use(notificationsRouter);

export default router;