import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Compass, Inbox, LayoutDashboard, LogOut, Shield, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { useMe, useSignOut, initials, type Role } from "@/lib/me";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

type NavItem = { to: string; label: string; icon: typeof Bell; roles: Role[] };
const NAV: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, roles: ["student", "teacher", "admin"] },
  { to: "/classes", label: "Classes", icon: BookOpen, roles: ["student", "teacher", "admin"] },
  { to: "/discover", label: "Discover", icon: Compass, roles: ["student"] },
  { to: "/requests", label: "Requests", icon: Inbox, roles: ["student", "teacher", "admin"] },
  { to: "/notifications", label: "Alerts", icon: Bell, roles: ["student", "teacher", "admin"] },
  { to: "/admin", label: "Admin", icon: Shield, roles: ["admin"] },
];

function Shell() {
  const { data: me } = useMe();
  const signOut = useSignOut();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: unread = 0 } = useQuery({
    queryKey: ["unread"],
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
  const items = NAV.filter((n) => me && n.roles.includes(me.role));

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <div className="px-2 py-2"><Logo /></div>
        <nav className="mt-6 flex-1 space-y-1">
          {items.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <n.icon className="h-4 w-4" />
                <span className="flex-1">{n.label === "Alerts" ? "Notifications" : n.label}</span>
                {n.to === "/notifications" && unread > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{unread}</span>}
              </Link>
            );
          })}
        </nav>
        {me && (
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">{initials(me.name)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{me.name}</div>
              <div className="text-xs capitalize text-muted-foreground">{me.role}</div>
            </div>
            <button onClick={signOut} aria-label="Sign out" className="text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /></button>
          </div>
        )}
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <button onClick={signOut} aria-label="Sign out" className="text-muted-foreground"><LogOut className="h-5 w-5" /></button>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10 md:pt-10">
        <div className="mx-auto max-w-5xl"><Outlet /></div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-card md:hidden">
        {items.map((n) => {
          const active = path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={cn("relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
              <n.icon className="h-5 w-5" />
              {n.label}
              {n.to === "/notifications" && unread > 0 && <span className="absolute right-1/4 top-1.5 h-2 w-2 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
