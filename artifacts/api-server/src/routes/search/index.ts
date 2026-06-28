import { Router, type IRouter } from "express";
import { SearchAllQueryParams } from "@workspace/api-zod";
import { DocumentModel, ReportModel, ConversationModel } from "../../lib/models";

const router: IRouter = Router();

router.get("/search", async (req, res): Promise<void> => {
  const params = SearchAllQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { q } = params.data;
  const re = { $regex: q, $options: "i" };

  const results: Array<{
    type: "document" | "report" | "conversation";
    id: number;
    title: string;
    excerpt: string;
    relevance: null;
    createdAt: string | null;
  }> = [];

  const [docs, reports, convs] = await Promise.all([
    DocumentModel.find({ $or: [{ name: re }, { extractedText: re }] }).limit(10).lean(),
    ReportModel.find({ $or: [{ title: re }, { executiveSummary: re }, { keyFindings: re }] }).limit(10).lean(),
    ConversationModel.find({ title: re }).limit(10).lean(),
  ]);

  for (const d of docs) {
    results.push({
      type: "document", id: d.id, title: d.name,
      excerpt: d.extractedText ? d.extractedText.slice(0, 150).replace(/\s+/g, " ") : `${d.fileType} — ${d.status}`,
      relevance: null, createdAt: new Date(d.uploadedAt).toISOString(),
    });
  }
  for (const r of reports) {
    results.push({
      type: "report", id: r.id, title: r.title,
      excerpt: r.executiveSummary ? r.executiveSummary.slice(0, 150) : `${r.status} report`,
      relevance: null, createdAt: new Date(r.createdAt).toISOString(),
    });
  }
  for (const c of convs) {
    results.push({
      type: "conversation", id: c.id, title: c.title,
      excerpt: `AI conversation — ${new Date(c.createdAt).toLocaleDateString()}`,
      relevance: null, createdAt: new Date(c.createdAt).toISOString(),
    });
  }

  res.json({ query: q, results, total: results.length });
});

export default router;
