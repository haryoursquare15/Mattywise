import { Router, type IRouter } from "express";
import {
  CreateConversationBody, GetConversationParams, DeleteConversationParams,
  SendConversationMessageParams, SendConversationMessageBody,
} from "@workspace/api-zod";
import { chatWithContext } from "../../lib/gemini";
import {
  ConversationModel, MessageModel, DocumentModel, DocumentAnalysisModel,
  ActivityModel, getNextId,
} from "../../lib/models";

const router: IRouter = Router();

router.get("/conversations", async (_req, res): Promise<void> => {
  const conversations = await ConversationModel.find().sort({ updatedAt: -1 }).lean();

  const ids = conversations.map((c) => c.id);
  const messages = await MessageModel.find({ conversationId: { $in: ids } }).lean();

  const countMap = new Map<number, { count: number; lastAt: string | null }>();
  for (const m of messages) {
    const entry = countMap.get(m.conversationId) ?? { count: 0, lastAt: null };
    entry.count++;
    if (!entry.lastAt || m.createdAt.toISOString() > entry.lastAt) {
      entry.lastAt = m.createdAt.toISOString();
    }
    countMap.set(m.conversationId, entry);
  }

  const result = conversations.map((c) => {
    const counts = countMap.get(c.id);
    return {
      ...c,
      documentIds: JSON.parse(c.documentIds) as number[],
      messageCount: counts?.count ?? 0,
      lastMessageAt: counts?.lastAt ?? null,
    };
  });

  res.json(result);
});

router.post("/conversations", async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const id = await getNextId("conversations");
  const conv = await ConversationModel.create({
    id, title: parsed.data.title,
    documentIds: JSON.stringify(parsed.data.documentIds ?? []),
  });

  await ActivityModel.create({
    id: await getNextId("activity"), type: "conversation_started",
    description: `AI conversation "${conv.title}" started`,
  });

  res.status(201).json({
    ...conv.toObject(),
    documentIds: JSON.parse(conv.documentIds) as number[],
    messageCount: 0, lastMessageAt: null,
  });
});

router.get("/conversations/:id", async (req, res): Promise<void> => {
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const conv = await ConversationModel.findOne({ id: params.data.id }).lean();
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await MessageModel.find({ conversationId: conv.id }).sort({ createdAt: 1 }).lean();
  res.json({
    ...conv,
    documentIds: JSON.parse(conv.documentIds) as number[],
    messageCount: msgs.length,
    lastMessageAt: msgs[msgs.length - 1]?.createdAt?.toISOString() ?? null,
    messages: msgs,
  });
});

router.delete("/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const conv = await ConversationModel.findOne({ id: params.data.id });
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await MessageModel.deleteMany({ conversationId: conv.id });
  await ConversationModel.deleteOne({ id: params.data.id });
  res.sendStatus(204);
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const idParam = SendConversationMessageParams.safeParse(req.params);
  if (!idParam.success) { res.status(400).json({ error: idParam.error.message }); return; }

  const parsed = SendConversationMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const conv = await ConversationModel.findOne({ id: idParam.data.id });
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  await MessageModel.create({
    id: await getNextId("messages"), conversationId: conv.id,
    role: "user", content: parsed.data.content,
  });

  const history = await MessageModel.find({ conversationId: conv.id }).sort({ createdAt: 1 }).lean();

  const docIds = JSON.parse(conv.documentIds) as number[];
  let documentContext = "";

  if (docIds.length > 0) {
    const docs = await DocumentModel.find({ id: { $in: docIds } }).lean();
    const analyses = await DocumentAnalysisModel.find({ documentId: { $in: docIds } }).lean();
    const analysisMap = new Map(analyses.map((a) => [a.documentId, a]));

    documentContext = docs.map((d) => {
      const a = analysisMap.get(d.id);
      return [
        `Document: ${d.name}`,
        a?.executiveSummary ? `Summary: ${a.executiveSummary}` : "",
        d.extractedText ? `Content excerpt: ${d.extractedText.slice(0, 3000)}` : "",
      ].filter(Boolean).join("\n");
    }).join("\n\n---\n\n");
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = await chatWithContext(
      history.map((m) => ({ role: m.role, content: m.content })),
      documentContext,
    );

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await MessageModel.create({
      id: await getNextId("messages"), conversationId: conv.id,
      role: "assistant", content: fullResponse,
    });

    conv.updatedAt = new Date();
    await conv.save();

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (_err) {
    res.write(`data: ${JSON.stringify({ error: "AI service error. Please ensure GEMINI_API_KEY is set.", done: true })}\n\n`);
    res.end();
  }
});

export default router;
