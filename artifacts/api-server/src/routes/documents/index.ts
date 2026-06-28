import { Router, type IRouter } from "express";
import {
  CreateDocumentBody,
  ListDocumentsQueryParams,
  GetDocumentParams,
  DeleteDocumentParams,
  AnalyzeDocumentParams,
} from "@workspace/api-zod";
import { analyzeBusinessDocument } from "../../lib/gemini";
import { extractTextFromBuffer } from "../../lib/documentParser";
import { ObjectStorageService } from "../../lib/objectStorage";
import {
  DocumentModel,
  DocumentAnalysisModel,
  ActivityModel,
  NotificationModel,
  getNextId,
} from "../../lib/models";

const storageService = new ObjectStorageService();
const router: IRouter = Router();

router.get("/documents", async (req, res): Promise<void> => {
  const params = ListDocumentsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const filter: Record<string, unknown> = {};
  if (params.data.status) filter["status"] = params.data.status;
  if (params.data.search) filter["name"] = { $regex: params.data.search, $options: "i" };

  const docs = await DocumentModel.find(filter).sort({ uploadedAt: -1 }).lean();
  res.json(docs);
});

router.post("/documents", async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const id = await getNextId("documents");
  const doc = await DocumentModel.create({
    id, name: parsed.data.name, fileType: parsed.data.fileType,
    objectPath: parsed.data.objectPath, fileSize: parsed.data.fileSize ?? null, status: "pending",
  });

  await ActivityModel.create({
    id: await getNextId("activity"), type: "document_uploaded",
    description: `Document "${doc.name}" uploaded`, documentId: id,
  });

  res.status(201).json(doc.toObject());
});

router.get("/documents/:id", async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const doc = await DocumentModel.findOne({ id: params.data.id }).lean();
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }

  const analysis = await DocumentAnalysisModel.findOne({ documentId: doc.id }).lean();
  res.json({ ...doc, analysis: analysis ?? null });
});

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const doc = await DocumentModel.findOne({ id: params.data.id });
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }

  await DocumentAnalysisModel.deleteMany({ documentId: doc.id });
  await DocumentModel.deleteOne({ id: params.data.id });
  res.sendStatus(204);
});

router.post("/documents/:id/analyze", async (req, res): Promise<void> => {
  const params = AnalyzeDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const doc = await DocumentModel.findOne({ id: params.data.id });
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }

  doc.status = "processing";
  await doc.save();
  res.status(202).json(doc.toObject());

  setImmediate(async () => {
    try {
      const objectPath = doc.objectPath.startsWith("/objects/") ? doc.objectPath : `/objects/${doc.objectPath}`;
      const file = await storageService.getObjectEntityFile(objectPath);
      const [fileContents] = await file.download();
      const buffer = Buffer.isBuffer(fileContents) ? fileContents : Buffer.from(fileContents);
      req.log.info(
        {
          documentId: doc.id,
          bytes: buffer.length,
        },
        "Downloaded file from R2",
      );
      const { text: extractedText, pageCount } = await extractTextFromBuffer(buffer, doc.fileType, doc.name);
      req.log.info(
        {
          documentId: doc.id,
          characters: extractedText.length,
          pageCount,
        },
        "Text extracted",
      );

      req.log.info(
        {
          documentId: doc.id,
          characters: extractedText.length,
        },
        "Sending document to Gemini",
      );

      const analysis = await analyzeBusinessDocument(extractedText, doc.name);
      
      req.log.info(
        {
          documentId: doc.id,
          healthScore: analysis.businessHealthScore,
          confidenceScore: analysis.confidenceScore,
        },
        "Gemini completed",
      );

      await DocumentAnalysisModel.create({ id: await getNextId("document_analyses"), documentId: doc.id, ...analysis });

      doc.status = "analyzed";
      doc.extractedText = extractedText.slice(0, 50000);
      doc.analyzedAt = new Date();
      doc.pageCount = pageCount ?? null;
      await doc.save();

      await ActivityModel.create({
        id: await getNextId("activity"), type: "document_analyzed",
        description: `AI analysis complete for "${doc.name}"`, documentId: doc.id,
      });

      if (analysis.businessHealthScore < 40 || analysis.risks) {
        await NotificationModel.create({
          id: await getNextId("notifications"), type: "risk_detected",
          message: `Risks detected in "${doc.name}": ${analysis.risks?.slice(0, 100)}...`, documentId: doc.id,
        });
      }
      await NotificationModel.create({
        id: await getNextId("notifications"), type: "analysis_complete",
        message: `Analysis complete for "${doc.name}" — Health Score: ${analysis.businessHealthScore}/100`, documentId: doc.id,
      });

    } catch (err) {
      console.error("====================================");
      console.error("DOCUMENT ANALYSIS FAILED");
      console.error("====================================");
      console.error(err);
    
      req.log.error(
        {
          err,
          documentId: doc.id,
          documentName: doc.name,
          objectPath: doc.objectPath,
          fileType: doc.fileType,
        },
        "Document analysis failed",
      );
    
      try {
        await DocumentModel.updateOne(
          { id: params.data.id },
          {
            status: "failed",
          },
        );
    
        await NotificationModel.create({
          id: await getNextId("notifications"),
          type: "analysis_failed",
          message:
            err instanceof Error
              ? err.message
              : "Unknown document analysis error",
          documentId: doc.id,
        });
      } catch (dbErr) {
        console.error("Failed updating document status");
        console.error(dbErr);
    
        req.log.error(
          {
            err: dbErr,
            documentId: doc.id,
          },
          "Failed updating failed document status",
        );
      }
    }
  });
});

export default router;
