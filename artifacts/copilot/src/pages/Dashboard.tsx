import React from "react";
import { useGetDashboardSummary, useGetDashboardActivity, useGetKpiTrends } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { FileText, BarChart3, MessageSquare, AlertTriangle, Lightbulb, Activity } from "lucide-react";
import { format } from "date-fns";

export function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: isLoadingActivity } = useGetDashboardActivity({ limit: 5 });
  const { data: trends, isLoading: isLoadingTrends } = useGetKpiTrends();

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Command Center</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">Real-time overview of business operations and document analysis.</p>
      </div>

      {/* Top Stats — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Documents" value={summary?.totalDocuments} icon={FileText} loading={isLoadingSummary} trend="+12% from last week" />
        <StatCard title="Reports Generated" value={summary?.totalReports} icon={BarChart3} loading={isLoadingSummary} trend="+4% from last week" />
        <StatCard title="Active Conversations" value={summary?.totalConversations} icon={MessageSquare} loading={isLoadingSummary} trend="8 currently active" />
        <StatCard
          title="Avg Health Score"
          value={summary?.averageHealthScore ? `${summary.averageHealthScore}/100` : "-"}
          icon={Activity}
          loading={isLoadingSummary}
          valueColor={summary?.averageHealthScore && summary.averageHealthScore > 80 ? "text-green-500" : "text-amber-500"}
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-base md:text-lg">Key Performance Indicators</CardTitle>
            <CardDescription className="text-xs md:text-sm">30-day trailing trends across primary metrics</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px] md:h-[300px]">
            {isLoadingTrends ? (
              <Skeleton className="w-full h-full rounded-md" />
            ) : trends && trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends[0].data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "MMM d")} stroke="rgba(255,255,255,0.4)" fontSize={11} tickMargin={8} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickFormatter={(v) => `$${v}`} width={40} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "#fff", fontSize: 12 }}
                    labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No trend data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-base md:text-lg">Business Health</CardTitle>
            <CardDescription className="text-xs md:text-sm">Multi-dimensional analysis</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart outerRadius="70%" data={[
                { subject: "Financial", A: 85, fullMark: 100 },
                { subject: "Operational", A: 78, fullMark: 100 },
                { subject: "Risk", A: 92, fullMark: 100 },
                { subject: "Compliance", A: 88, fullMark: 100 },
                { subject: "Strategic", A: 70, fullMark: 100 },
              ]}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                <Radar name="Health" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Risks, Opportunities, Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
              <CardTitle className="text-sm md:text-base">Top Risks Detected</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : summary?.topRisks && summary.topRisks.length > 0 ? (
              <ul className="space-y-2">
                {summary.topRisks.map((risk, i) => (
                  <li key={i} className="text-xs md:text-sm p-2.5 rounded bg-amber-500/10 text-amber-100 border border-amber-500/20">
                    {risk}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No significant risks detected.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <CardTitle className="text-sm md:text-base">Strategic Opportunities</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : summary?.topOpportunities && summary.topOpportunities.length > 0 ? (
              <ul className="space-y-2">
                {summary.topOpportunities.map((opp, i) => (
                  <li key={i} className="text-xs md:text-sm p-2.5 rounded bg-primary/10 text-primary-100 border border-primary/20">
                    {opp}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No current opportunities identified.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm md:text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-3">
                {activity.map((item) => (
                  <div key={item.id} className="flex gap-3 text-sm">
                    <div className="mt-0.5 w-2 h-2 rounded-full bg-primary shrink-0 relative top-1.5" />
                    <div>
                      <p className="text-foreground text-xs md:text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(item.createdAt), "MMM d, h:mm a")}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title, value, icon: Icon, loading, trend, valueColor = "text-foreground",
}: {
  title: string;
  value?: string | number | null;
  icon: any;
  loading?: boolean;
  trend?: string;
  valueColor?: string;
}) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 p-3 md:p-4 opacity-10">
        <Icon className="w-12 h-12 md:w-16 md:h-16" />
      </div>
      <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
        <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground leading-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
        {loading ? (
          <Skeleton className="h-7 md:h-8 w-16 md:w-20" />
        ) : (
          <div className={`text-2xl md:text-3xl font-bold ${valueColor}`}>{value ?? 0}</div>
        )}
        {trend && !loading && (
          <p className="text-[10px] md:text-xs text-muted-foreground mt-1 font-medium">{trend}</p>
        )}
      </CardContent>
    </Card>
  );
}
