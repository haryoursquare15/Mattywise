import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";

const MODEL = "gemini-2.5-flash";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

function getGenai(): GoogleGenAI {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is required. Please add your Gemini API key in the Secrets tab.",
    );
  }
  return new GoogleGenAI({ apiKey });
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable =
        err instanceof Error &&
        (err.message.includes("503") ||
          err.message.includes("429") ||
          err.message.includes("UNAVAILABLE") ||
          err.message.includes("overloaded"));
      if (!isRetryable || attempt === MAX_RETRIES) break;
      logger.warn({ attempt, label }, "Gemini transient error — retrying");
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
  throw lastError;
}

function cleanJson(text: string): string {
  const s = text.trim();
  // Strip any markdown code fences anywhere in the string
  const stripped = s.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  // Find the first { and last } to extract the JSON object
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) return stripped;
  return stripped.slice(start, end + 1);
}

export async function analyzeBusinessDocument(
  extractedText: string,
  fileName: string,
): Promise<{
  executiveSummary: string;
  kpis: string;
  keyFindings: string;
  positiveFindings: string;
  negativeFindings: string;
  risks: string;
  opportunities: string;
  recommendations: string;
  anomalies: string;
  departments: string;
  businessHealthScore: number;
  confidenceScore: number;
}> {
  const prompt = `You are MattyWise AI — a senior management consultant and business intelligence analyst with expertise across finance, operations, strategy, and risk.

Your task: Perform a rigorous, data-driven analysis of the business document below. Think step-by-step before producing the JSON. Identify both obvious and non-obvious insights. Quantify wherever possible.

Document: "${fileName}"

Content (first 30 000 chars):
${extractedText.slice(0, 30000)}

Return ONLY a valid JSON object with exactly these fields — no markdown, no code fences:

{
  "executiveSummary": "2-3 paragraph synthesis. Lead with the single most important insight. Be specific and quantitative where possible. Write for a board-level audience.",
  "kpis": [{"name": "string", "value": "string", "trend": "up|down|stable", "context": "1-sentence explanation of significance"}],
  "keyFindings": ["Specific, evidence-backed finding (include numbers from the document)", "..."],
  "positiveFindings": "Concrete paragraph on strengths and wins — reference specific metrics or milestones from the document.",
  "negativeFindings": "Concrete paragraph on weaknesses and underperformance — reference specific data points.",
  "risks": "Risk assessment paragraph. Classify each risk as high/medium/low and explain its potential financial or operational impact.",
  "opportunities": "Opportunity analysis paragraph. For each opportunity, estimate its relative scale of impact (high/medium/low).",
  "recommendations": [{"action": "Specific, actionable recommendation", "priority": "high|medium|low", "impact": "Measurable expected outcome", "department": "Owning team", "timeframe": "e.g. 30 days / Q2 / H2"}],
  "anomalies": "Describe any outliers, statistical anomalies, or patterns that deserve closer scrutiny. Explain why each is significant.",
  "departments": "Comma-separated list of departments mentioned or directly implicated",
  "businessHealthScore": 75,
  "confidenceScore": 85
}

businessHealthScore: 0–100. 90+ = excellent, 75–89 = healthy, 60–74 = concerns, < 60 = critical issues.
confidenceScore: 0–100. Reflect the depth and quality of information available in the document.

Constraints:
- Base every claim strictly on the document content. Do not fabricate numbers.
- If a field cannot be populated from the document, write "Insufficient data" — never hallucinate.
- Return ONLY the JSON object.`;

  const ai = getGenai();
  const text = await withRetry("analyzeBusinessDocument", async () => {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 16384 },
    });
    return response.text ?? "{}";
  });

  const parsed = JSON.parse(cleanJson(text));
  return {
    executiveSummary: parsed.executiveSummary ?? "",
    kpis: JSON.stringify(parsed.kpis ?? []),
    keyFindings: JSON.stringify(parsed.keyFindings ?? []),
    positiveFindings: parsed.positiveFindings ?? "",
    negativeFindings: parsed.negativeFindings ?? "",
    risks: parsed.risks ?? "",
    opportunities: parsed.opportunities ?? "",
    recommendations: JSON.stringify(parsed.recommendations ?? []),
    anomalies: parsed.anomalies ?? "",
    departments: parsed.departments ?? "",
    businessHealthScore: Number(parsed.businessHealthScore) || 0,
    confidenceScore: Number(parsed.confidenceScore) || 0,
  };
}

export async function generateExecutiveReport(
  documentAnalyses: Array<{ name: string; summary: string; kpis: string; findings: string }>,
  reportTitle: string,
): Promise<{
  executiveSummary: string;
  keyFindings: string;
  kpis: string;
  trends: string;
  positiveFindings: string;
  negativeFindings: string;
  riskAssessment: string;
  opportunities: string;
  strategicRecommendations: string;
  immediateActions: string;
  longTermActions: string;
  financialSummary: string;
  swotAnalysis: string;
  aiInsights: string;
  confidenceScore: number;
}> {
  const docsContext = documentAnalyses
    .map((d) => `## ${d.name}\nSummary: ${d.summary}\nKPIs: ${d.kpis}\nFindings: ${d.findings}`)
    .join("\n\n");

  const prompt = `You are MattyWise AI, a McKinsey senior partner with deep expertise in corporate strategy, financial analysis, and operational transformation. You are preparing a board-ready executive report.

Report Title: "${reportTitle}"
Number of source documents: ${documentAnalyses.length}

Source Analyses:
${docsContext.slice(0, 25000)}

Instructions:
1. Synthesize across ALL documents — do not just repeat each one individually.
2. Surface cross-document themes, corroborating evidence, and contradictions.
3. Prioritise findings by business impact (revenue, risk, reputation).
4. Write recommendations in the MECE framework — mutually exclusive, collectively exhaustive.
5. The SWOT must reference specific data from the documents.
6. "AI Insights" should reveal non-obvious patterns a human analyst might miss.

Return ONLY a valid JSON object — no markdown, no code fences:

{
  "executiveSummary": "Comprehensive 3-4 paragraph synthesis. Open with the most consequential finding. Be quantitative. Write for a non-technical board audience.",
  "keyFindings": "5-8 numbered key findings, each referencing specific data. Focus on cross-document insights.",
  "kpis": "Consolidated KPI narrative — highlight the most important metrics, their trends, and business implications.",
  "trends": "3-5 major trends identified across the document set. For each: describe the trend, evidence supporting it, and projected impact.",
  "positiveFindings": "Strengths and wins — consolidated across all documents, referenced to source data.",
  "negativeFindings": "Weaknesses and underperformance — consolidated, with severity assessment.",
  "riskAssessment": "Risk register narrative: list risks, classify HIGH/MEDIUM/LOW, describe probability and potential financial/operational impact.",
  "opportunities": "Prioritised opportunity analysis. For each: opportunity, evidence, estimated impact, recommended owner.",
  "strategicRecommendations": "Top 5-7 strategic recommendations. Each: what to do, why it matters, who owns it, success metric.",
  "immediateActions": "3-5 actions to take in the next 30 days with specific owners and deliverables.",
  "longTermActions": "3-5 actions for the 6-12 month horizon with milestones.",
  "financialSummary": "Financial health overview: revenue trajectory, cost structure, cash flow signals, and capital allocation implications.",
  "swotAnalysis": "SWOT matrix as prose: each quadrant (Strengths, Weaknesses, Opportunities, Threats) in 2-3 sentences grounded in document evidence.",
  "aiInsights": "3-5 non-obvious patterns, correlations, or leading indicators that a human analyst might overlook. Explain the implication of each.",
  "confidenceScore": 82
}

Return ONLY the JSON object.`;

  const ai = getGenai();
  const text = await withRetry("generateExecutiveReport", async () => {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 32768 },
    });
    return response.text ?? "{}";
  });

  const parsed = JSON.parse(cleanJson(text));
  return {
    executiveSummary: parsed.executiveSummary ?? "",
    keyFindings: parsed.keyFindings ?? "",
    kpis: parsed.kpis ?? "",
    trends: parsed.trends ?? "",
    positiveFindings: parsed.positiveFindings ?? "",
    negativeFindings: parsed.negativeFindings ?? "",
    riskAssessment: parsed.riskAssessment ?? "",
    opportunities: parsed.opportunities ?? "",
    strategicRecommendations: parsed.strategicRecommendations ?? "",
    immediateActions: parsed.immediateActions ?? "",
    longTermActions: parsed.longTermActions ?? "",
    financialSummary: parsed.financialSummary ?? "",
    swotAnalysis: parsed.swotAnalysis ?? "",
    aiInsights: parsed.aiInsights ?? "",
    confidenceScore: Number(parsed.confidenceScore) || 0,
  };
}

export async function chatWithContext(
  messages: Array<{ role: string; content: string }>,
  documentContext: string,
): Promise<AsyncIterable<{ text?: string }>> {
  const systemPrompt = `You are MattyWise AI — an expert AI Business Operations Copilot and senior analyst. You have been given access to a set of business documents and their analyses.

Your responsibilities:
- Answer questions strictly grounded in the document context below.
- When asked for opinions or recommendations, reason from the data — do not guess.
- Quantify insights wherever possible (reference specific numbers, dates, or metrics from the documents).
- If information is not in the documents, say "That information is not available in the uploaded documents" and then offer relevant general business expertise as context.
- Be concise and precise — avoid padding or generic management-speak.
- When appropriate, proactively surface related risks or opportunities the user may not have asked about.

Document Context:
${documentContext.slice(0, 15000)}`;

  const contents = [
    { role: "user" as const, parts: [{ text: systemPrompt }] },
    {
      role: "model" as const,
      parts: [
        {
          text: "Understood. I have reviewed the provided business documents and I am ready to assist with evidence-based analysis, strategic recommendations, and any questions about the content.",
        },
      ],
    },
    ...messages.map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: [{ text: m.content }],
    })),
  ];

  const ai = getGenai();
  return ai.models.generateContentStream({
    model: MODEL,
    contents,
    config: { maxOutputTokens: 8192 },
  });
}
