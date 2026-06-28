import React from "react";
import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export function Notifications() {
  const { data: notifications, isLoading } = useListNotifications();
  const queryClient = useQueryClient();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkRead = async (id: number) => {
    await markRead.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };

  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync();
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "risk_detected": return <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-500" />;
      case "kpi_alert":     return <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />;
      case "analysis_complete":
      case "report_ready":  return <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-green-500" />;
      default:              return <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Alerts and system updates</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllRead}
          disabled={!notifications?.some((n) => !n.read) || markAllRead.isPending}
          className="self-start sm:self-auto"
        >
          <Check className="w-4 h-4 mr-2" /> Mark all read
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/50 bg-card/50">
              <CardContent className="p-4 h-16" />
            </Card>
          ))
        ) : notifications && notifications.length > 0 ? (
          notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`border-border/50 transition-colors ${
                !notif.read ? "bg-secondary/40 border-primary/20" : "bg-card/30 opacity-70"
              }`}
            >
              <CardContent className="p-3 md:p-4 flex gap-3 md:gap-4 items-start md:items-center">
                <div className="shrink-0 mt-0.5 md:mt-0">{getIcon(notif.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs md:text-sm ${!notif.read ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {notif.message}
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                    {format(new Date(notif.createdAt), "MMM d, h:mm a")}
                  </p>
                </div>
                {!notif.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkRead(notif.id)}
                    className="shrink-0 text-xs h-7 px-2"
                  >
                    Mark Read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">You're all caught up.</p>
          </div>
        )}
      </div>
    </div>
  );
}
