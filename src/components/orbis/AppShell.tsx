import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { Menu, LogOut, Search, PanelLeftClose, PanelLeft, Moon, Sun } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { nav } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { GlobalSearch } from "./GlobalSearch";

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<Record<string, unknown>>>)[name];
  return C ? <C className={className ?? ""} /> : null;
}

function useTheme() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("orbis-theme");
    const isDark = saved !== "light";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem("orbis-theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }

  return { dark, toggle };
}

function useEmail() {
  const [email, setEmail] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);
  return email;
}

function initials(email: string) {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "OR").toUpperCase();
}

function ProfileCard({ email, collapsed }: { email: string; collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "m-3 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 p-3",
        collapsed && "m-2 p-2",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <div className="grid size-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials(email)}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-sidebar bg-success" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {email || "Signed in"}
            </p>
            <p className="text-[11px] text-sidebar-foreground/50">Online</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NavList({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className={cn("space-y-5 p-3 pb-8", collapsed && "px-2")}>
      {nav.map((g) => (
        <div key={g.group}>
          {!collapsed ? (
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {g.group}
            </p>
          ) : (
            <div className="mx-2 mb-2 border-t border-sidebar-border" />
          )}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to as never}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-primary/15 font-medium text-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon name={item.icon} className="size-4 shrink-0" />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openNav, setOpenNav] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { dark, toggle } = useTheme();
  const email = useEmail();

  useEffect(() => {
    const saved = localStorage.getItem("orbis-sidebar");
    if (saved === "collapsed") {
      setCollapsed(true);
      return;
    }
    if (saved === "expanded") {
      setCollapsed(false);
      return;
    }
    setCollapsed(window.innerWidth < 1024);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem("orbis-sidebar", prev ? "expanded" : "collapsed");
      return !prev;
    });
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth" as never, replace: true });
  }

  // Topbar uses the sidebar palette in BOTH themes.
  // In light mode this yields the brand navy-blue bar; in dark mode
  // it blends with the near-black sidebar. Same colors, always dark.
  const topbarBg = "bg-sidebar border-sidebar-border text-sidebar-foreground";

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Fixed sidebar ───────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden overflow-y-auto border-r border-sidebar-border bg-sidebar print:hidden md:block",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-sidebar-border bg-sidebar px-4",
            collapsed && "justify-center px-0",
          )}
        >
          <div className="grid size-7 shrink-0 place-items-center rounded bg-primary text-xs font-bold text-primary-foreground">
            OR
          </div>
          {!collapsed ? (
            <span className="font-semibold tracking-tight text-sidebar-foreground">
              Orbis Logistics
            </span>
          ) : null}
        </div>
        <ProfileCard email={email} collapsed={collapsed} />
        <NavList collapsed={collapsed} />
      </aside>

      {/* ─── Main content ────────────────────────────────────── */}
      <div className={cn("transition-[padding] duration-200", collapsed ? "md:pl-16" : "md:pl-64")}>
        {/* Topbar — navy blue in light mode, dark in dark mode */}
        <header
          className={cn(
            "sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-3 backdrop-blur print:hidden sm:px-4",
            topbarBg,
          )}
        >
          <Sheet open={openNav} onOpenChange={setOpenNav}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground hover:bg-white/10 hover:text-white md:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto border-sidebar-border bg-sidebar p-0">
              <SheetTitle className="px-4 pt-4 text-base text-sidebar-foreground">
                Orbis Logistics
              </SheetTitle>
              <ProfileCard email={email} />
              <NavList onNavigate={() => setOpenNav(false)} />
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            className="hidden text-sidebar-foreground hover:bg-white/10 hover:text-white md:inline-flex"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
          >
            {collapsed ? <PanelLeft className="size-5" /> : <PanelLeftClose className="size-5" />}
          </Button>

          {/* Search pill — subtle glass on the navy bar */}
          <button
            onClick={() => setOpenSearch(true)}
            className="flex flex-1 items-center gap-2 rounded-md border border-sidebar-border bg-white/5 px-3 py-1.5 text-sm text-sidebar-foreground/60 transition-colors hover:bg-white/10 hover:text-sidebar-foreground sm:max-w-md"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">
              <span className="hidden sm:inline">Search trips, loads, vehicles, drivers, tires…</span>
              <span className="sm:hidden">Search…</span>
            </span>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-white/10 hover:text-white"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-sidebar-foreground hover:bg-white/10 hover:text-white"
              onClick={signOut}
            >
              <LogOut className="mr-1.5 size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>

        <main className="w-full p-3 sm:p-5 lg:p-6 xl:p-8">{children}</main>
      </div>

      <GlobalSearch open={openSearch} onOpenChange={setOpenSearch} />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 print:hidden">{actions}</div> : null}
    </div>
  );
}
