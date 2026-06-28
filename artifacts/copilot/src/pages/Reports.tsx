import React, { useState } from "react";
import { useListReports, useCreateReport, useDeleteReport, useListDocuments, getListReportsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart3, Plus, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export function Reports() {
  const { data: reports, isLoading } = useListReports();
  const { data: documents } = useListDocuments({ status: "analyzed" });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createReport = useCreateReport();
  const deleteReport = useDeleteReport();

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);

  const handleCreate = async () => {
    if (!title || selectedDocs.length === 0) return;
    try {
      await createReport.mutateAsync({ data: { title, documentIds: selectedDocs } });
      queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
      setIsOpen(false);
      setTitle("");
      setSelectedDocs([]);
      toast({ title: "Report generation started" });
    } catch (err: any) {
      toast({ title: "Failed to create report", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteReport.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
      toast({ title: "Report deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const toggleDoc = (id: number) => {
    setSelectedDocs((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Executive Reports</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">AI-synthesized intelligence across multiple documents.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="self-start sm:self-auto">
              <Plus className="w-4 h-4 mr-2" /> New Report
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[500px] max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate New Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Report Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q3 Financial Overview..." />
              </div>
              <div className="space-y-2">
                <Label>Select Source Documents</Label>
                <div className="border border-border/50 rounded-md p-2 h-48 md:h-64 overflow-y-auto space-y-2 bg-secondary/20">
                  {documents?.map((doc) => (
                    <div key={doc.id} className="flex items-center space-x-2 p-2 hover:bg-secondary/50 rounded-md">
                      <Checkbox id={`doc-${doc.id}`} checked={selectedDocs.includes(doc.id)} onCheckedChange={() => toggleDoc(doc.id)} />
                      <label htmlFor={`doc-${doc.id}`} className="text-sm font-medium leading-none cursor-pointer flex-1 truncate">
                        {doc.name}
                      </label>
                    </div>
                  ))}
                  {(!documents || documents.length === 0) && (
                    <div className="text-center p-4 text-sm text-muted-foreground">No analyzed documents available.</div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!title || selectedDocs.length === 0 || createReport.isPending} className="w-full sm:w-auto">
                {createReport.isPending ? "Generating…" : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
        ) : reports && reports.length > 0 ? (
          reports.map((report) => (
            <Card key={report.id} className="border-border/50 bg-card/50 backdrop-blur-sm flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="p-2 w-9 h-9 md:w-10 md:h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      report.status === "ready"
                        ? "bg-green-500/10 text-green-500 border-green-500/20"
                        : report.status === "generating"
                        ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                    }
                  >
                    {report.status}
                  </Badge>
                </div>
                <CardTitle className="mt-3 text-base md:text-lg line-clamp-2" title={report.title}>
                  {report.title}
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  {format(new Date(report.createdAt), "MMM d, yyyy")} &bull; {report.documentCount} sources
                </CardDescription>
              </CardHeader>
              <div className="flex-1" />
              <CardContent className="pt-0 flex justify-between items-center">
                <div className="text-xs md:text-sm font-medium text-muted-foreground">
                  Confidence: <span className="text-foreground">{report.confidenceScore || 0}%</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(report.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" asChild disabled={report.status !== "ready"}>
                    <Link href={`/reports/${report.id}`}>View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No reports yet</h3>
            <p className="text-sm text-muted-foreground">Generate a report by selecting analyzed documents.</p>
          </div>
        )}
      </div>
    </div>
  );
}
