import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Files,
  BarChart3,
  MessageSquare,
  Search as SearchIcon,
  Bell,
  Menu,
  X,
  LogOut,
  Brain,
} from "lucide-react";
import { useListNotifications } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: notifications } = useListNotifications({ unreadOnly: true });
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const unreadCount = notifications?.length || 0;

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Documents", href: "/documents", icon: Files },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Search", href: "/search", icon: SearchIcon },
    { name: "Notifications", href: "/notifications", icon: Bell, badge: unreadCount },
  ];

  const initials = user?.name
    ? user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "MU";

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="w-7 h-7 bg-primary rounded-sm shadow-[0_0_15px_rgba(0,240,255,0.4)] flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <span>MattyWise AI</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                />
                {item.name}
              </div>
              {(item.badge ?? 0) > 0 && (
                <Badge
                  variant="default"
                  className="h-5 px-1.5 flex items-center justify-center bg-primary text-primary-foreground text-xs"
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
            {initials}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate">{user?.name || "Matthew Ufondu"}</span>
            <span className="text-xs text-muted-foreground truncate">{user?.username || "mufondu"}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            onClick={logout}
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-[100dvh] w-full bg-background dark text-foreground">
      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar shrink-0 flex-col hidden md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="absolute top-3 right-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-14 border-b border-border bg-background flex items-center px-4 shrink-0 justify-between sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 font-bold text-base">
            <div className="w-6 h-6 bg-primary rounded-sm shadow-[0_0_10px_rgba(0,240,255,0.4)] flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
            <span>MattyWise</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            onClick={logout}
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto w-full h-full">{children}</div>
        </div>
      </main>
    </div>
  );
}
