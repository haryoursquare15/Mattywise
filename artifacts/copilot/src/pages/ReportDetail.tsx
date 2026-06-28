import React from "react";
import { useGetReport, getGetReportQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, ShieldAlert, LineChart, Cpu, DollarSign, ListTodo } from "lucide-react";
import { format } from "date-fns";

export function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading } = useGetReport(Number(id), { query: { enabled: !!id, queryKey: getGetReportQueryKey(Number(id)) } });

  if (isLoading) {
    return <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>;
  }

  if (!report) {
    return <div className="text-center py-12 text-muted-foreground">Report not found.</div>;
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="rounded-full shrink-0 mt-0.5">
          <Link href="/reports"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-foreground break-words">{report.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generated {format(new Date(report.createdAt), "MMMM d, yyyy")} &bull; Confidence: {report.confidenceScore || 0}%
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4 text-primary flex items-center gap-2"><Target className="w-5 h-5" /> Executive Summary</h2>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <p className="text-sm md:text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {report.executiveSummary || "No summary available."}
              </p>
            </CardContent>
          </Card>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section>
            <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2"><ListTodo className="w-5 h-5 text-muted-foreground" /> Key Findings</h2>
            <Card className="border-border/50 h-full">
              <CardContent className="pt-6">
                <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                  {report.keyFindings || "No findings available."}
                </p>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-500" /> Risk Assessment</h2>
            <Card className="border-border/50 h-full">
              <CardContent className="pt-6">
                <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                  {report.riskAssessment || "No risk assessment available."}
                </p>
              </CardContent>
            </Card>
          </section>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-500" /> Financial Summary</h2>
          <Card className="border-border/50 bg-secondary/30">
            <CardContent className="pt-6">
              <p className="text-sm md:text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {report.financialSummary || "No financial summary available."}
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2"><LineChart className="w-5 h-5 text-primary" /> Strategic Recommendations</h2>
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Immediate Actions</h3>
                  <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{report.immediateActions || "None"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Long-term Strategy</h3>
                  <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{report.longTermActions || "None"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">General Recommendations</h3>
                  <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{report.strategicRecommendations || "None"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {report.aiInsights && (
          <section>
            <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2"><Cpu className="w-5 h-5 text-purple-500" /> AI Insights</h2>
            <Card className="border-border/50 border-purple-500/20 bg-purple-500/5">
              <CardContent className="pt-6">
                <p className="text-sm md:text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {report.aiInsights}
                </p>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
