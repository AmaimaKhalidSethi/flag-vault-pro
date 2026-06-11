import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, FileText, Users, User, Settings, LogOut, Plus, Menu, X, Trophy, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { openCommandPalette } from "@/components/CommandPalette";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/writeups", label: "Writeups", icon: FileText },
  { to: "/events", label: "Events", icon: Trophy },
  { to: "/team", label: "Team", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AppLayout() {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth" });
  }, [loading, session, nav]);

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/" });
  }

  if (loading || !session) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground mono text-sm">authenticating…</div>;
  }

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-border bg-card/70 backdrop-blur-md transition-[width]",
        collapsed ? "w-16" : "w-56"
      )}>
        <div className="h-14 flex items-center justify-between px-3 border-b border-border">
          <Link to="/dashboard" className="flex items-center gap-2 overflow-hidden">
            <div className="size-7 rounded bg-primary text-primary-foreground grid place-items-center font-bold shrink-0">F</div>
            {!collapsed && <span className="font-semibold">Flagvault</span>}
          </Link>
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <Menu className="size-4" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1">
          <Link to="/writeups/new" className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90",
            collapsed && "justify-center px-0"
          )}>
            <Plus className="size-4" />{!collapsed && "New writeup"}
          </Link>

          <button
            onClick={openCommandPalette}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition",
              collapsed && "justify-center px-0"
            )}
            title="Search (⌘K)"
          >
            <Search className="size-4" />
            {!collapsed && (
              <>
                <span>Search…</span>
                <kbd className="ml-auto mono text-[10px] border border-border rounded px-1.5 py-0.5">⌘K</kbd>
              </>
            )}
          </button>

          <div className="h-px bg-border my-2" />

          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeProps={{ className: "bg-muted text-foreground" }}
              activeOptions={{ exact: false }}
              className={cn(
                "relative flex items-center gap-2 px-3 py-2 rounded-md text-sm transition",
                "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                collapsed && "justify-center px-0"
              )}
            >
              <n.icon className="size-4" />
              {!collapsed && <span>{n.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-2 border-t border-border space-y-1">
          <div className={cn("flex", collapsed ? "justify-center" : "justify-between items-center px-1")}>
            {!collapsed && <span className="text-xs text-muted-foreground">Theme</span>}
            <ThemeToggle />
          </div>
          <button onClick={signOut} className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted",
            collapsed && "justify-center px-0"
          )}>
            <LogOut className="size-4" />{!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/80" onClick={() => setMobileOpen(false)}>
          <aside className="w-60 h-full bg-card border-r border-border p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">Flagvault</span>
              <button onClick={() => setMobileOpen(false)}><X className="size-4" /></button>
            </div>
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted">
                <n.icon className="size-4" />{n.label}
              </Link>
            ))}
            <button onClick={signOut} className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground w-full">
              <LogOut className="size-4" />Sign out
            </button>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-border bg-card/70 backdrop-blur-md">
          <button onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button>
          <span className="font-semibold">Flagvault</span>
          <div className="flex items-center gap-2">
            <button onClick={openCommandPalette} title="Search"><Search className="size-5 text-muted-foreground" /></button>
            <ThemeToggle />
            <Link to="/writeups/new"><Plus className="size-5 text-primary" /></Link>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>

        {/* Mobile bottom tabs */}
        <nav className="md:hidden border-t border-border bg-card grid grid-cols-6">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: false }}
              className="flex flex-col items-center justify-center py-2 text-xs text-muted-foreground"
            >
              <n.icon className="size-4 mb-0.5" />
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
