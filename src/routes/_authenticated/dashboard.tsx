import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, timeAgo } from "@/lib/me";
import { fetchMyClasses } from "@/lib/queries";
import { ClassCard } from "@/components/ClassCard";
import { Card, Empty, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CampusOS" }, { name: "description", content: "Your CampusOS overview." }] }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Dashboard() {
  const { data: me } = useMe();
  const classes = useQuery({ queryKey: ["myClasses", me?.id], enabled: !!me, queryFn: () => fetchMyClasses(me!.id, me!.role) });
  const pending = useQuery({
    queryKey: ["pendingCount", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { count } = await supabase.from("join_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
  });
  const posts = useQuery({
    queryKey: ["recentPosts"],
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("id, title, type, created_at, class_id, class:classes(name)").order("created_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });
  const notes = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  if (!me) return null;
  const first = me.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`${greeting()}, ${first}`} subtitle="Here's what's happening across your classes." action={me.role === "student" ? <Button asChild><Link to="/discover">Discover classes</Link></Button> : undefined} />
      <div className="mb-8 grid grid-cols-3 gap-3">
        <Stat label="My classes" value={classes.data?.length ?? "–"} />
        <Stat label={me.role === "student" ? "Pending requests" : "Requests to review"} value={pending.data ?? "–"} />
        <Stat label="Unread alerts" value={notes.data?.filter((n) => !n.read).length ?? "–"} />
      </div>
      <section className="mb-10">
        <h2 className="mb-4 font-semibold">My classes</h2>
        {classes.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2">{classes.data.slice(0, 4).map((c) => <ClassCard key={c.id} c={c} />)}</div>
        ) : (
          <Empty title="No classes yet" text={me.role === "student" ? "Request to join a class to get started." : me.role === "teacher" ? "An administrator will assign classes to you." : "Create classes from the Admin area."} />
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Recent posts</h2>
          {posts.data?.length ? (
            <ul className="divide-y">
              {posts.data.map((p) => (
                <li key={p.id} className="py-3">
                  <Link to="/classes/$classId" params={{ classId: p.class_id }} className="block hover:text-primary">
                    <div className="text-sm font-medium">{p.title}</div>
                    <div className="text-xs capitalize text-muted-foreground">{p.type} · {(p.class as { name: string } | null)?.name} · {timeAgo(p.created_at)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nothing posted yet.</p>}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Notifications</h2><Link to="/notifications" className="text-sm text-primary">View all</Link></div>
          {notes.data?.length ? (
            <ul className="divide-y">
              {notes.data.map((n) => (
                <li key={n.id} className="py-3">
                  <div className="flex items-center gap-2 text-sm font-medium">{!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}{n.title}</div>
                  <div className="text-xs text-muted-foreground">{n.body} · {timeAgo(n.created_at)}</div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">You're all caught up.</p>}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
