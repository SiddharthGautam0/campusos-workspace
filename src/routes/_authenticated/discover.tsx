import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { CLASS_SELECT, classPath, type ClassRow } from "@/lib/queries";
import { PageHeader, Empty } from "@/components/common";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({ meta: [{ title: "Discover classes — CampusOS" }, { name: "description", content: "Find classes and request to join." }] }),
  component: Discover,
});

function Discover() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("all");
  const [year, setYear] = useState("all");
  const [section, setSection] = useState("all");

  const classes = useQuery({
    queryKey: ["allClasses"],
    queryFn: async () => ((await supabase.from("classes").select(CLASS_SELECT).order("name")).data ?? []) as unknown as ClassRow[],
  });
  const status = useQuery({
    queryKey: ["myStatus", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const [m, r] = await Promise.all([
        supabase.from("class_members").select("class_id").eq("user_id", me!.id),
        supabase.from("join_requests").select("class_id").eq("student_id", me!.id).eq("status", "pending"),
      ]);
      return { members: new Set((m.data ?? []).map((x) => x.class_id)), pending: new Set((r.data ?? []).map((x) => x.class_id)) };
    },
  });

  const request = useMutation({
    mutationFn: async (classId: string) => {
      const { error } = await supabase.from("join_requests").insert({ class_id: classId, student_id: me!.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request sent to the teacher"); qc.invalidateQueries({ queryKey: ["myStatus"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const all = classes.data ?? [];
  const opts = useMemo(() => {
    const uniq = <T,>(arr: T[], key: (t: T) => string) => [...new Map(arr.map((a) => [key(a), a])).values()];
    return {
      courses: uniq(all.map((c) => c.section.year.course), (c) => c.id),
      years: uniq(all.filter((c) => course === "all" || c.section.year.course.id === course).map((c) => c.section.year), (y) => y.id),
      sections: uniq(all.filter((c) => year === "all" || c.section.year.id === year).map((c) => c.section), (s) => s.id),
    };
  }, [all, course, year]);

  const filtered = all.filter((c) =>
    (course === "all" || c.section.year.course.id === course) &&
    (year === "all" || c.section.year.id === year) &&
    (section === "all" || c.section.id === section) &&
    (`${c.name} ${c.code} ${c.teacher?.full_name ?? ""}`.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <>
      <PageHeader title="Discover classes" subtitle="Find your classes and request access from the teacher." />
      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Filter value={course} onChange={(v) => { setCourse(v); setYear("all"); setSection("all"); }} placeholder="All courses" items={opts.courses.map((c) => ({ id: c.id, label: c.code }))} />
        <Filter value={year} onChange={(v) => { setYear(v); setSection("all"); }} placeholder="All years" items={opts.years.map((y) => ({ id: y.id, label: y.label }))} />
        <Filter value={section} onChange={setSection} placeholder="All sections" items={opts.sections.map((s) => ({ id: s.id, label: s.name }))} />
      </div>
      {filtered.length === 0 ? <Empty title="No classes match" /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c) => {
            const member = status.data?.members.has(c.id);
            const pending = status.data?.pending.has(c.id);
            return (
              <div key={c.id} className="flex flex-col rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{c.code}</span>
                  <span className="text-xs text-muted-foreground">{classPath(c)}</span>
                </div>
                <h3 className="mt-3 font-semibold">{c.name}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{c.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{c.teacher?.full_name ?? "No teacher yet"}</span>
                  {member ? <span className="text-sm font-medium text-success">Joined</span>
                    : pending ? <span className="text-sm font-medium text-muted-foreground">Request pending</span>
                    : <Button size="sm" disabled={!c.teacher_id || request.isPending} onClick={() => request.mutate(c.id)}>{c.teacher_id ? "Request to join" : "Unavailable"}</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Filter({ value, onChange, placeholder, items }: { value: string; onChange: (v: string) => void; placeholder: string; items: { id: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
