import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, timeAgo, type Role } from "@/lib/me";
import { CLASS_SELECT, classPath, type ClassRow } from "@/lib/queries";
import { Card, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.rpc("has_role", { _user_id: u.user!.id, _role: "admin" });
    if (!data) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Admin — CampusOS" }, { name: "description", content: "Manage the academic structure, people and audit log." }] }),
  component: Admin,
});

function Admin() {
  return (
    <>
      <PageHeader title="Administration" subtitle="Academic structure, classes, people and audit trail." />
      <Tabs defaultValue="structure">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto">
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="structure"><Structure /></TabsContent>
        <TabsContent value="classes"><ClassesAdmin /></TabsContent>
        <TabsContent value="people"><PeopleAdmin /></TabsContent>
        <TabsContent value="audit"><Audit /></TabsContent>
      </Tabs>
    </>
  );
}

function useHierarchy() {
  return useQuery({
    queryKey: ["hierarchy"],
    queryFn: async () => (await supabase.from("courses").select("id, name, code, years(id, label, position, sections(id, name))").order("code")).data ?? [],
  });
}

function Structure() {
  const qc = useQueryClient();
  const h = useHierarchy();
  const [cName, setCName] = useState(""); const [cCode, setCCode] = useState("");
  const refresh = () => qc.invalidateQueries();
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) toast.error(error.message); else refresh(); };

  return (
    <div className="space-y-4">
      <Card>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(supabase.from("courses").insert({ name: cName, code: cCode.toUpperCase() })); setCName(""); setCCode(""); }}>
          <Input required className="w-28" placeholder="Code" value={cCode} onChange={(e) => setCCode(e.target.value)} />
          <Input required className="flex-1" placeholder="Course name, e.g. Bachelor of Business Administration" value={cName} onChange={(e) => setCName(e.target.value)} />
          <Button>Add course</Button>
        </form>
      </Card>
      {h.data?.map((c) => (
        <Card key={c.id}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold"><span className="text-primary">{c.code}</span> · {c.name}</h3>
            <Button variant="ghost" size="icon" onClick={() => confirm("Delete course and everything inside?") && run(supabase.from("courses").delete().eq("id", c.id))}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="mt-3 space-y-3">
            {[...c.years].sort((a, b) => a.position - b.position).map((y) => (
              <div key={y.id} className="rounded-xl bg-muted/60 p-3">
                <div className="flex items-center justify-between text-sm font-medium">
                  {y.label}
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => run(supabase.from("years").delete().eq("id", y.id))}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {y.sections.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs">
                      {s.name}
                      <button onClick={() => run(supabase.from("sections").delete().eq("id", s.id))} className="text-muted-foreground hover:text-destructive">×</button>
                    </span>
                  ))}
                  <InlineAdd placeholder="Section" onAdd={(v) => run(supabase.from("sections").insert({ year_id: y.id, name: v }))} />
                </div>
              </div>
            ))}
            <InlineAdd placeholder="Add year, e.g. 2nd Year" onAdd={(v) => run(supabase.from("years").insert({ course_id: c.id, label: v, position: c.years.length + 1 }))} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function InlineAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } }}>
      <Input className="h-8 w-44 text-xs" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
      <Button size="sm" variant="outline" className="h-8">Add</Button>
    </form>
  );
}

function ClassesAdmin() {
  const qc = useQueryClient();
  const h = useHierarchy();
  const classes = useQuery({ queryKey: ["allClasses"], queryFn: async () => ((await supabase.from("classes").select(CLASS_SELECT).order("name")).data ?? []) as unknown as ClassRow[] });
  const teachers = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data: r } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      const ids = (r ?? []).map((x) => x.user_id);
      if (!ids.length) return [];
      return (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? [];
    },
  });
  const sections = (h.data ?? []).flatMap((c) => c.years.flatMap((y) => y.sections.map((s) => ({ id: s.id, label: `${c.code} · ${y.label} · ${s.name}` }))));
  const [sectionId, setSectionId] = useState(""); const [name, setName] = useState(""); const [code, setCode] = useState(""); const [desc, setDesc] = useState("");

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionId) return toast.error("Choose a section");
    const { error } = await supabase.from("classes").insert({ section_id: sectionId, name, code: code.toUpperCase(), description: desc });
    if (error) return toast.error(error.message);
    setName(""); setCode(""); setDesc(""); toast.success("Class created"); qc.invalidateQueries();
  };
  const assign = async (id: string, teacher: string) => {
    const { error } = await supabase.from("classes").update({ teacher_id: teacher === "none" ? null : teacher }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Teacher updated"); qc.invalidateQueries(); }
  };
  const del = async (id: string) => { if (!confirm("Delete this class?")) return; await supabase.from("classes").delete().eq("id", id); qc.invalidateQueries(); };

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={create} className="grid gap-2 md:grid-cols-2">
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
            <SelectContent>{sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2"><Input required className="w-28" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} /><Input required placeholder="Class / subject name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <Input className="md:col-span-2" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button className="md:col-span-2">Create class</Button>
        </form>
      </Card>
      <div className="divide-y rounded-2xl border bg-card">
        {classes.data?.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><div className="text-sm font-medium">{c.code} · {c.name}</div><div className="text-xs text-muted-foreground">{classPath(c)}</div></div>
            <Select value={c.teacher_id ?? "none"} onValueChange={(v) => assign(c.id, v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No teacher</SelectItem>
                {teachers.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PeopleAdmin() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [search, setSearch] = useState("");
  const people = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roles = new Map((r ?? []).map((x) => [x.user_id, x.role as Role]));
      return (p ?? []).map((x) => ({ ...x, role: roles.get(x.id) ?? "student" }));
    },
  });
  const setRole = async (id: string, role: Role) => {
    const { error } = await supabase.rpc("set_user_role", { _user: id, _role: role });
    if (error) toast.error(error.message); else { toast.success("Role updated"); qc.invalidateQueries(); }
  };
  const list = (people.data ?? []).filter((p) => `${p.full_name} ${p.email}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4">
      <Input placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="divide-y rounded-2xl border bg-card">
        {list.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><div className="text-sm font-medium">{p.full_name}</div><div className="text-xs text-muted-foreground">{p.email} · joined {timeAgo(p.created_at)}</div></div>
            <Select value={p.role} disabled={p.id === me?.id} onValueChange={(v) => setRole(p.id, v as Role)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="teacher">Teacher</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

function Audit() {
  const logs = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
      const ids = [...new Set((data ?? []).map((l) => l.actor_id).filter(Boolean))] as string[];
      const { data: p } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      const names = new Map((p ?? []).map((x) => [x.id, x.full_name]));
      return (data ?? []).map((l) => ({ ...l, actor: l.actor_id ? names.get(l.actor_id) ?? "Unknown" : "System" }));
    },
  });
  const label = (d: unknown) => { const o = d as Record<string, unknown>; return String(o.name ?? o.label ?? o.code ?? o.role ?? ""); };
  return (
    <div className="divide-y rounded-2xl border bg-card">
      {logs.data?.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center gap-2 p-4 text-sm">
          <span className="font-medium">{l.actor}</span>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold capitalize text-secondary-foreground">{l.action}</span>
          <span className="text-muted-foreground">{l.entity.replace("_", " ")}</span>
          <span className="flex-1 truncate">{label(l.details)}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(l.created_at)}</span>
        </div>
      ))}
      {!logs.data?.length && <p className="p-4 text-sm text-muted-foreground">No administrative actions yet.</p>}
    </div>
  );
}
