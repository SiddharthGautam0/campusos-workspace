import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/lib/me";
import { fetchMyClasses } from "@/lib/queries";
import { ClassCard } from "@/components/ClassCard";
import { Empty, PageHeader } from "@/components/common";

export const Route = createFileRoute("/_authenticated/classes/")({
  head: () => ({ meta: [{ title: "My classes — CampusOS" }, { name: "description", content: "Classes you belong to." }] }),
  component: Classes,
});

function Classes() {
  const { data: me } = useMe();
  const q = useQuery({ queryKey: ["myClasses", me?.id], enabled: !!me, queryFn: () => fetchMyClasses(me!.id, me!.role) });
  return (
    <>
      <PageHeader title={me?.role === "admin" ? "All classes" : "My classes"} subtitle="Your authorized academic spaces." />
      {q.isLoading ? <p className="text-muted-foreground">Loading…</p> : q.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2">{q.data.map((c) => <ClassCard key={c.id} c={c} />)}</div>
      ) : <Empty title="No classes yet" />}
    </>
  );
}
