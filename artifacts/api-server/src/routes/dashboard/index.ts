import { Router, type IRouter } from "express";
import { GetDashboardActivityQueryParams } from "@workspace/api-zod";
import {
  DocumentModel, DocumentAnalysisModel, ReportModel,
  ConversationModel, NotificationModel, ActivityModel,
} from "../../lib/models";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [totalDocs, analyzedDocs, pendingDocs, totalReports, totalConvos, unreadNotifs] =
    await Promise.all([
      DocumentModel.countDocuments(),
      DocumentModel.countDocuments({ status: "analyzed" }),
      DocumentModel.countDocuments({ status: { $in: ["pending", "processing"] } }),
      ReportModel.countDocuments(),
      ConversationModel.countDocuments(),
      NotificationModel.countDocuments({ read: false }),
    ]);

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentAnalyses = await DocumentAnalysisModel.countDocuments({ createdAt: { $gte: oneWeekAgo } });

  const scoreAgg = await DocumentAnalysisModel.aggregate([
    { $group: { _id: null, avgHealth: { $avg: "$businessHealthScore" }, avgConf: { $avg: "$confidenceScore" } } },
  ]);
  const avgHealth = scoreAgg[0]?.avgHealth ? Math.round(scoreAgg[0].avgHealth) : null;
  const avgConf   = scoreAgg[0]?.avgConf   ? Math.round(scoreAgg[0].avgConf)   : null;

  const riskAnalyses = await DocumentAnalysisModel.find({ risks: { $ne: null } })
    .sort({ createdAt: -1 }).limit(5).lean();
  const oppAnalyses = await DocumentAnalysisModel.find({ opportunities: { $ne: null } })
    .sort({ createdAt: -1 }).limit(3).lean();

  const topRisks = riskAnalyses
    .flatMap((a) => (a.risks ? [a.risks.split(".")[0]?.trim()].filter(Boolean) : []))
    .slice(0, 5) as string[];
  const topOpportunities = oppAnalyses
    .flatMap((a) => (a.opportunities ? [a.opportunities.split(".")[0]?.trim()].filter(Boolean) : []))
    .slice(0, 3) as string[];

  res.json({
    totalDocuments: totalDocs,
    analyzedDocuments: analyzedDocs,
    pendingDocuments: pendingDocs,
    totalReports,
    totalConversations: totalConvos,
    recentAnalyses,
    averageHealthScore: avgHealth,
    averageConfidenceScore: avgConf,
    topRisks,
    topOpportunities,
    unreadNotifications: unreadNotifs,
  });
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const params = GetDashboardActivityQueryParams.safeParse(req.query);
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 20;

  const activities = await ActivityModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  res.json(activities);
});

router.get("/dashboard/kpi-trends", async (_req, res): Promise<void> => {
  const analyses = await DocumentAnalysisModel.find()
    .sort({ createdAt: 1 }).limit(30).lean();

  const docCounts = await DocumentModel.aggregate([
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$uploadedAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $limit: 30 },
  ]);

  const healthData = analyses.map((a) => ({
    date: new Date(a.createdAt).toISOString().split("T")[0],
    value: a.businessHealthScore ? Math.round(a.businessHealthScore) : 0,
    label: null,
  }));

  const confidenceData = analyses.map((a) => ({
    date: new Date(a.createdAt).toISOString().split("T")[0],
    value: a.confidenceScore ? Math.round(a.confidenceScore) : 0,
    label: null,
  }));

  const uploadData = docCounts.map((d) => ({
    date: d._id,
    value: d.count,
    label: null,
  }));

  res.json([
    { name: "Business Health Score", data: healthData },
    { name: "AI Confidence Score", data: confidenceData },
    { name: "Documents Uploaded", data: uploadData },
  ]);
});

export default router;
