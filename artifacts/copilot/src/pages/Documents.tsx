import React, { useState } from "react";
import { useListDocuments, useCreateDocument, useDeleteDocument, useAnalyzeDocument, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, UploadCloud, Trash2, Activity, Play, Eye } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export function Documents() {
  const [search, setSearch] = useState("");
  const { data: documents, isLoading } = useListDocuments(search ? { search } : undefined);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createDoc = useCreateDocument();
  const deleteDoc = useDeleteDocument();
  const analyzeDoc = useAnalyzeDocument();

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) await handleUpload(e.dataTransfer.files[0]);
  };
  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) await handleUpload(e.target.files[0]);
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const res = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
      });
      if (!res.ok) throw new Error("Failed to request upload URL");
      const { uploadURL, objectPath } = await res.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Failed to upload file to storage");

      const doc = await createDoc.mutateAsync({
        data: { name: file.name, fileType: file.type || "application/octet-stream", objectPath, fileSize: file.size },
      });
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });

      toast({ title: "Upload successful", description: "Triggering AI analysis..." });
      await analyzeDoc.mutateAsync({ id: doc.id });
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDoc.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      toast({ title: "Document deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const handleAnalyze = async (id: number) => {
    try {
      await analyzeDoc.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      toast({ title: "Analysis started" });
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Documents</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">Upload and manage source materials for AI analysis.</p>
      </div>

      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 md:p-10 flex flex-col items-center justify-center transition-colors ${
          isDragging ? "border-primary bg-primary/10" : "border-border/50 bg-card/20"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <UploadCloud className={`w-10 h-10 md:w-12 md:h-12 mb-3 md:mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
        <h3 className="text-base md:text-lg font-medium text-foreground mb-1">
          {isDragging ? "Drop file here" : "Drag & drop files here"}
        </h3>
        <p className="text-xs md:text-sm text-muted-foreground mb-4 text-center">
          Support for PDF, DOCX, TXT, CSV, XLSX and more.
        </p>
        <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()} disabled={isUploading}>
          {isUploading ? "Uploading…" : "Browse Files"}
        </Button>
        <input id="file-upload" type="file" className="hidden" onChange={onFileSelect} disabled={isUploading} />
      </div>

      {/* Document List */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Document Repository</CardTitle>
            <CardDescription>All uploaded documents and their processing status</CardDescription>
          </div>
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56"
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 md:p-4 rounded-md border border-border/50 bg-card hover:bg-accent/5 transition-colors gap-3"
                >
                  {/* Doc info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-md bg-secondary flex items-center justify-center text-primary shrink-0">
                      <FileText className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{doc.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(doc.uploadedAt), "MMM d, yyyy")} &bull;{" "}
                        {(doc.fileSize ? doc.fileSize / 1024 / 1024 : 0).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <StatusBadge status={doc.status} />
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/documents/${doc.id}`}><Eye className="w-4 h-4" /></Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleAnalyze(doc.id)}
                        disabled={doc.status === "processing"}
                        title="Re-analyze"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No documents found</h3>
              <p className="text-sm text-muted-foreground">Upload your first document to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string }> = {
    pending: { className: "bg-amber-500/10 text-amber-500 border-amber-500/20", label: "Pending" },
    processing: { className: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "Processing" },
    analyzed: { className: "bg-green-500/10 text-green-500 border-green-500/20", label: "Analyzed" },
    failed: { className: "bg-red-500/10 text-red-500 border-red-500/20", label: "Failed" },
  };
  const c = config[status] || config.pending;
  return (
    <Badge variant="outline" className={`${c.className} shrink-0`}>
      {c.label}
    </Badge>
  );
}
