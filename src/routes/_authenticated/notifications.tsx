import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, timeAgo } from "@/lib/me";
import { Empty, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — CampusOS" }, { name: "description", content: "Your CampusOS notifications." }] }),
  component: Notifications,
});

function Notifications() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`notif-${me.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
        qc.invalidateQueries({ queryKey: ["unread"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, qc]);

  const markAll = useMutation({
    mutationFn: async () => { await supabase.from("notifications").update({ read: true }).eq("read", false).eq("user_id", me!.id); },
    onSuccess: () => qc.invalidateQueries(),
  });
  const markOne = async (id: string) => { await supabase.from("notifications").update({ read: true }).eq("id", id); qc.invalidateQueries(); };

  return (
    <>
      <PageHeader title="Notifications" action={<Button variant="outline" onClick={() => markAll.mutate()}>Mark all read</Button>} />
      {!q.data?.length ? <Empty title="No notifications" text="Requests, approvals and new posts will appear here." /> : (
        <div className="divide-y rounded-2xl border bg-card">
          {q.data.map((n) => (
            <Link key={n.id} to={(n.link ?? "/dashboard") as "/dashboard"} onClick={() => markOne(n.id)} className="flex items-start gap-3 p-4 hover:bg-muted/50">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} />
              <div className="flex-1">
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-sm text-muted-foreground">{n.body}</div>
              </div>
              <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
