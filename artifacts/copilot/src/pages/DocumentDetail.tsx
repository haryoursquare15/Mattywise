import React from "react";
import { useGetDocument, getGetDocumentQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, Lightbulb, TrendingUp } from "lucide-react";

export function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: doc, isLoading } = useGetDocument(Number(id), { query: { enabled: !!id, queryKey: getGetDocumentQueryKey(Number(id)) } });

  if (isLoading) {
    return <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>;
  }

  if (!doc) {
    return <div className="text-center py-12 text-muted-foreground">Document not found.</div>;
  }

  const parseJSON = (str?: string | null): any[] => {
    if (!str) return [];
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const kpis = parseJSON(doc.analysis?.kpis);
  const keyFindings = parseJSON(doc.analysis?.keyFindings);
  const recommendations = parseJSON(doc.analysis?.recommendations);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="rounded-full shrink-0 mt-0.5">
          <Link href="/documents"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground break-words">{doc.name}</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 shrink-0">{doc.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</p>
        </div>
      </div>

      {!doc.analysis ? (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            Analysis is pending or failed.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {doc.analysis.executiveSummary || "No summary available."}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm flex flex-col justify-center items-center py-6">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg text-muted-foreground">Health Score</CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-0">
                <div className={`text-6xl font-bold ${doc.analysis.businessHealthScore && doc.analysis.businessHealthScore > 80 ? "text-green-500" : doc.analysis.businessHealthScore && doc.analysis.businessHealthScore > 50 ? "text-amber-500" : "text-red-500"}`}>
                  {doc.analysis.businessHealthScore || "-"}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Confidence: {doc.analysis.confidenceScore || 0}%</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <CardTitle>Key Findings</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {keyFindings.length > 0 ? (
                  <ul className="space-y-3">
                    {keyFindings.map((finding: any, i: number) => (
                      <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span>{typeof finding === 'string' ? finding : finding.description || JSON.stringify(finding)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">None identified.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <CardTitle>KPIs</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {kpis.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {kpis.map((kpi: any, i: number) => (
                      <div key={i} className="p-3 rounded-md border border-border/50 bg-secondary/50">
                        <p className="text-xs text-muted-foreground mb-1">{kpi.name || kpi.metric || 'Metric'}</p>
                        <p className="text-lg font-bold text-foreground">{kpi.value || kpi.amount || '-'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">None identified.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <CardTitle>Risks & Anomalies</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Risks</h4>
                  <p className="text-sm text-foreground/80">{doc.analysis.risks || "None identified."}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Anomalies</h4>
                  <p className="text-sm text-foreground/80">{doc.analysis.anomalies || "None identified."}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  <CardTitle>Opportunities & Recommendations</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Opportunities</h4>
                  <p className="text-sm text-foreground/80">{doc.analysis.opportunities || "None identified."}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recommendations</h4>
                  {recommendations.length > 0 ? (
                    <ul className="space-y-2 mt-2">
                      {recommendations.map((rec: any, i: number) => (
                        <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <span>{typeof rec === 'string' ? rec : rec.action || rec.description || JSON.stringify(rec)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">None identified.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
