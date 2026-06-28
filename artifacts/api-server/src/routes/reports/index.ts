import { Router, type IRouter } from "express";
import { CreateReportBody, GetReportParams, DeleteReportParams } from "@workspace/api-zod";
import { generateExecutiveReport } from "../../lib/gemini";
import {
  ReportModel, DocumentModel, DocumentAnalysisModel,
  ActivityModel, NotificationModel, getNextId,
} from "../../lib/models";

const router: IRouter = Router();

router.get("/reports", async (_req, res): Promise<void> => {
  const reports = await ReportModel.find().sort({ createdAt: -1 }).lean();
  const result = reports.map((r) => ({
    ...r, documentCount: (JSON.parse(r.documentIds) as number[]).length,
  }));
  res.json(result);
});

router.post("/reports", async (req, res): Promise<void> => {
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const id = await getNextId("reports");
  const report = await ReportModel.create({
    id, title: parsed.data.title,
    documentIds: JSON.stringify(parsed.data.documentIds), status: "generating",
  });

  res.status(202).json({ ...report.toObject(), documentCount: parsed.data.documentIds.length });

  setImmediate(async () => {
    try {
      const docs = await DocumentModel.find({ id: { $in: parsed.data.documentIds } }).lean();
      const analyses = await DocumentAnalysisModel.find({ documentId: { $in: parsed.data.documentIds } }).lean();
      const analysisMap = new Map(analyses.map((a) => [a.documentId, a]));

      const docContexts = docs.map((d) => {
        const a = analysisMap.get(d.id);
        return {
          name: d.name,
          summary: a?.executiveSummary ?? d.extractedText?.slice(0, 2000) ?? "No analysis available",
          kpis: a?.kpis ?? "[]",
          findings: a?.keyFindings ?? "[]",
        };
      });

      const generated = await generateExecutiveReport(docContexts, parsed.data.title);

      await ReportModel.updateOne(
        { id },
        { status: "ready", ...generated, documentIds: JSON.stringify(parsed.data.documentIds), updatedAt: new Date() },
      );

      await ActivityModel.create({
        id: await getNextId("activity"), type: "report_generated",
        description: `Executive report "${parsed.data.title}" generated`, reportId: id,
      });
      await NotificationModel.create({
        id: await getNextId("notifications"), type: "report_ready",
        message: `Executive report "${parsed.data.title}" is ready`, reportId: id,
      });
    } catch (_err) {
      await ReportModel.updateOne({ id }, { status: "failed" });
    }
  });
});

router.get("/reports/:id", async (req, res): Promise<void> => {
  const params = GetReportParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const report = await ReportModel.findOne({ id: params.data.id }).lean();
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }

  const documentIds = JSON.parse(report.documentIds) as number[];
  res.json({ ...report, documentIds, documentCount: documentIds.length });
});

router.delete("/reports/:id", async (req, res): Promise<void> => {
  const params = DeleteReportParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const report = await ReportModel.findOne({ id: params.data.id });
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }

  await ReportModel.deleteOne({ id: params.data.id });
  res.sendStatus(204);
});

export default router;
