import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, timeAgo } from "@/lib/me";
import { Empty, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({ meta: [{ title: "Join requests — CampusOS" }, { name: "description", content: "Review and track class join requests." }] }),
  component: Requests,
});

type Req = { id: string; status: string; created_at: string; class_id: string; student_id: string; class: { name: string; code: string } | null; student: { full_name: string; email: string | null } | null };

function Requests() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const reviewer = me?.role !== "student";
  const q = useQuery({
    queryKey: ["requests", me?.id],
    enabled: !!me,
    queryFn: async () => {
      let query = supabase.from("join_requests").select("id, status, created_at, class_id, student_id, class:classes(name, code), student:profiles!join_requests_student_id_fkey(full_name, email)").order("created_at", { ascending: false });
      if (!reviewer) query = query.eq("student_id", me!.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Req[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("join_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.status === "approved" ? "Student added to class" : "Request declined"); qc.invalidateQueries(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("join_requests").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Request cancelled"); qc.invalidateQueries(); },
  });

  const list = q.data ?? [];
  const pending = list.filter((r) => r.status === "pending");
  const past = list.filter((r) => r.status !== "pending");

  return (
    <>
      <PageHeader title={reviewer ? "Join requests" : "My requests"} subtitle={reviewer ? "Approve students into your classes." : "Track the classes you asked to join."} />
      <h2 className="mb-3 font-semibold">Pending ({pending.length})</h2>
      {pending.length === 0 ? <Empty title="No pending requests" /> : (
        <div className="space-y-3">
          {pending.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
              <div>
                <div className="font-medium">{reviewer ? r.student?.full_name : r.class?.name}</div>
                <div className="text-sm text-muted-foreground">{reviewer ? `${r.student?.email ?? ""} → ${r.class?.code} ${r.class?.name}` : r.class?.code} · {timeAgo(r.created_at)}</div>
              </div>
              {reviewer ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => decide.mutate({ id: r.id, status: "rejected" })}>Decline</Button>
                  <Button size="sm" onClick={() => decide.mutate({ id: r.id, status: "approved" })}>Approve</Button>
                </div>
              ) : <Button variant="outline" size="sm" onClick={() => cancel.mutate(r.id)}>Cancel</Button>}
            </div>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 font-semibold">History</h2>
          <div className="divide-y rounded-2xl border bg-card">
            {past.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4 text-sm">
                <span>{reviewer ? `${r.student?.full_name} → ` : ""}{r.class?.name}</span>
                <span className={r.status === "approved" ? "font-medium text-success" : "font-medium text-destructive"}>{r.status}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
