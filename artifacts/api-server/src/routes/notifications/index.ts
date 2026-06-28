import { Router, type IRouter } from "express";
import { ListNotificationsQueryParams, MarkNotificationReadParams } from "@workspace/api-zod";
import { NotificationModel } from "../../lib/models";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const params = ListNotificationsQueryParams.safeParse(req.query);
  const filter: Record<string, unknown> = {};
  if (params.success && params.data.unreadOnly) filter["read"] = false;

  const notifications = await NotificationModel.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  res.json(notifications);
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const notif = await NotificationModel.findOneAndUpdate(
    { id: params.data.id }, { read: true }, { new: true }
  ).lean();

  if (!notif) { res.status(404).json({ error: "Notification not found" }); return; }
  res.json(notif);
});

router.post("/notifications/mark-all-read", async (_req, res): Promise<void> => {
  const result = await NotificationModel.updateMany({ read: false }, { read: true });
  res.json({ updated: result.modifiedCount });
});

export default router;
