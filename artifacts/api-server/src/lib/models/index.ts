import { Schema, model, type Document } from "mongoose";

/* ─── Auto-increment counter ─── */
const CounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = model("Counter", CounterSchema);

export async function getNextId(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true },
  );
  return (doc as unknown as { seq: number }).seq;
}

/* ─── Document ─── */
export interface IDocument extends Document {
  id: number;
  name: string;
  fileType: string;
  objectPath: string;
  fileSize: number | null;
  status: "pending" | "processing" | "analyzed" | "failed";
  extractedText: string | null;
  pageCount: number | null;
  uploadedAt: Date;
  analyzedAt: Date | null;
}
const DocumentSchema = new Schema<IDocument>({
  id:            { type: Number, required: true, unique: true, index: true },
  name:          { type: String, required: true },
  fileType:      { type: String, required: true },
  objectPath:    { type: String, required: true },
  fileSize:      { type: Number, default: null },
  status:        { type: String, default: "pending" },
  extractedText: { type: String, default: null },
  pageCount:     { type: Number, default: null },
  uploadedAt:    { type: Date, default: () => new Date() },
  analyzedAt:    { type: Date, default: null },
});
export const DocumentModel = model<IDocument>("Document", DocumentSchema);

/* ─── DocumentAnalysis ─── */
export interface IDocumentAnalysis extends Document {
  id: number;
  documentId: number;
  executiveSummary: string | null;
  kpis: string | null;
  keyFindings: string | null;
  recommendations: string | null;
  risks: string | null;
  opportunities: string | null;
  anomalies: string | null;
  departments: string | null;
  businessHealthScore: number;
  confidenceScore: number;
  createdAt: Date;
}
const DocumentAnalysisSchema = new Schema<IDocumentAnalysis>({
  id:                  { type: Number, required: true, unique: true, index: true },
  documentId:          { type: Number, required: true, index: true },
  executiveSummary:    { type: String, default: null },
  kpis:                { type: String, default: null },
  keyFindings:         { type: String, default: null },
  recommendations:     { type: String, default: null },
  risks:               { type: String, default: null },
  opportunities:       { type: String, default: null },
  anomalies:           { type: String, default: null },
  departments:         { type: String, default: null },
  businessHealthScore: { type: Number, default: 0 },
  confidenceScore:     { type: Number, default: 0 },
  createdAt:           { type: Date, default: () => new Date() },
});
export const DocumentAnalysisModel = model<IDocumentAnalysis>("DocumentAnalysis", DocumentAnalysisSchema);

/* ─── Report ─── */
export interface IReport extends Document {
  id: number;
  title: string;
  documentIds: string;
  status: "generating" | "ready" | "failed";
  executiveSummary: string | null;
  keyFindings: string | null;
  riskAssessment: string | null;
  financialSummary: string | null;
  immediateActions: string | null;
  longTermActions: string | null;
  strategicRecommendations: string | null;
  aiInsights: string | null;
  confidenceScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}
const ReportSchema = new Schema<IReport>({
  id:                       { type: Number, required: true, unique: true, index: true },
  title:                    { type: String, required: true },
  documentIds:              { type: String, default: "[]" },
  status:                   { type: String, default: "generating" },
  executiveSummary:         { type: String, default: null },
  keyFindings:              { type: String, default: null },
  riskAssessment:           { type: String, default: null },
  financialSummary:         { type: String, default: null },
  immediateActions:         { type: String, default: null },
  longTermActions:          { type: String, default: null },
  strategicRecommendations: { type: String, default: null },
  aiInsights:               { type: String, default: null },
  confidenceScore:          { type: Number, default: null },
  createdAt:                { type: Date, default: () => new Date() },
  updatedAt:                { type: Date, default: () => new Date() },
});
export const ReportModel = model<IReport>("Report", ReportSchema);

/* ─── Conversation ─── */
export interface IConversation extends Document {
  id: number;
  title: string;
  documentIds: string;
  createdAt: Date;
  updatedAt: Date;
}
const ConversationSchema = new Schema<IConversation>({
  id:          { type: Number, required: true, unique: true, index: true },
  title:       { type: String, required: true },
  documentIds: { type: String, default: "[]" },
  createdAt:   { type: Date, default: () => new Date() },
  updatedAt:   { type: Date, default: () => new Date() },
});
export const ConversationModel = model<IConversation>("Conversation", ConversationSchema);

/* ─── Message ─── */
export interface IMessage extends Document {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: Date;
}
const MessageSchema = new Schema<IMessage>({
  id:             { type: Number, required: true, unique: true, index: true },
  conversationId: { type: Number, required: true, index: true },
  role:           { type: String, required: true },
  content:        { type: String, required: true },
  createdAt:      { type: Date, default: () => new Date() },
});
export const MessageModel = model<IMessage>("Message", MessageSchema);

/* ─── Notification ─── */
export interface INotification extends Document {
  id: number;
  type: string;
  message: string;
  read: boolean;
  documentId: number | null;
  reportId: number | null;
  createdAt: Date;
}
const NotificationSchema = new Schema<INotification>({
  id:         { type: Number, required: true, unique: true, index: true },
  type:       { type: String, required: true },
  message:    { type: String, required: true },
  read:       { type: Boolean, default: false },
  documentId: { type: Number, default: null },
  reportId:   { type: Number, default: null },
  createdAt:  { type: Date, default: () => new Date() },
});
export const NotificationModel = model<INotification>("Notification", NotificationSchema);

/* ─── Activity ─── */
export interface IActivity extends Document {
  id: number;
  type: string;
  description: string;
  documentId: number | null;
  reportId: number | null;
  createdAt: Date;
}
const ActivitySchema = new Schema<IActivity>({
  id:          { type: Number, required: true, unique: true, index: true },
  type:        { type: String, required: true },
  description: { type: String, required: true },
  documentId:  { type: Number, default: null },
  reportId:    { type: Number, default: null },
  createdAt:   { type: Date, default: () => new Date() },
});
export const ActivityModel = model<IActivity>("Activity", ActivitySchema);
