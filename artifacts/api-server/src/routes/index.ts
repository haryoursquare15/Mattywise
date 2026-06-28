import { Router, type IRouter } from "express";
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

router.use(authRouter);
router.use(healthRouter);
router.use(storageRouter);
router.use(documentsRouter);
router.use(reportsRouter);
router.use(conversationsRouter);
router.use(dashboardRouter);
router.use(searchRouter);
router.use(notificationsRouter);

export default router;
