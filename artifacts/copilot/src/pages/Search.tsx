import React, { useState } from "react";
import { useSearchAll } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, FileText, BarChart3, MessageSquare, Lightbulb } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export function Search() {
  const [query, setQuery] = useState("");
  // Only search if query has length
  const { data: searchResults, isLoading } = useSearchAll({ q: query }, { query: { enabled: query.length > 0, queryKey: ["searchAll", query] } });

  const iconMap: Record<string, any> = {
    document: FileText,
    report: BarChart3,
    conversation: MessageSquare,
    recommendation: Lightbulb
  };

  const colorMap: Record<string, string> = {
    document: "text-blue-500",
    report: "text-green-500",
    conversation: "text-purple-500",
    recommendation: "text-amber-500"
  };

  const getHref = (type: string, id: number) => {
    if (type === 'document') return `/documents/${id}`;
    if (type === 'report') return `/reports/${id}`;
    if (type === 'conversation') return `/chat`; // Ideally goes to chat with active id
    return "/";
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Global Search</h1>
        <p className="text-muted-foreground">Search across all documents, reports, and AI insights.</p>
        <div className="relative max-w-2xl mx-auto mt-4">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for metrics, risks, or topics..." 
            className="w-full pl-12 h-14 text-lg bg-card/50 backdrop-blur-sm border-primary/20 focus-visible:ring-primary/50"
          />
        </div>
      </div>

      {query.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            {isLoading ? "Searching..." : `Found ${searchResults?.total || 0} results`}
          </p>

          <div className="space-y-4">
            {searchResults?.results.map((result, i) => {
              const Icon = iconMap[result.type] || SearchIcon;
              return (
                <Link key={i} href={getHref(result.type, result.id)}>
                  <Card className="border-border/50 bg-card/50 hover:bg-accent/5 transition-colors cursor-pointer group">
                    <CardContent className="p-4 flex gap-4">
                      <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
                        <Icon className={`w-5 h-5 ${colorMap[result.type]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="uppercase text-[10px] py-0">{result.type}</Badge>
                          {result.relevance && (
                            <span className="text-xs text-muted-foreground">Match: {Math.round(result.relevance * 100)}%</span>
                          )}
                          {result.createdAt && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(new Date(result.createdAt), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{result.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{result.excerpt}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
