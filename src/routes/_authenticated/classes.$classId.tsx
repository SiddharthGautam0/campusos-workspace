import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, ExternalLink, FileText, Link2, Megaphone, NotebookPen, Plus, Send, Trash2, Upload, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, timeAgo, initials } from "@/lib/me";
import { CLASS_SELECT, classPath, type ClassRow } from "@/lib/queries";
import { askAssistant } from "@/lib/assistant.functions";
import { Card, Empty } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/classes/$classId")({
  head: () => ({ meta: [{ title: "Class workspace — CampusOS" }, { name: "description", content: "Feed, subjects, people, files and AI assistant." }] }),
  component: Workspace,
});

function Workspace() {
  const { classId } = Route.useParams();
  const { data: me } = useMe();
  const cls = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => (await supabase.from("classes").select(CLASS_SELECT).eq("id", classId).maybeSingle()).data as unknown as ClassRow | null,
  });
  const access = useQuery({
    queryKey: ["access", classId, me?.id],
    enabled: !!me,
    queryFn: async () => (await supabase.rpc("can_access_class", { _class: classId, _user: me!.id })).data ?? false,
  });

  if (!me || cls.isLoading || access.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!cls.data) return <Empty title="Class not found" />;
  const c = cls.data;
  const canManage = me.role === "admin" || c.teacher_id === me.id;

  return (
    <>
      <Link to="/classes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Classes</Link>
      <div className="mb-6 rounded-2xl bg-primary p-6 text-primary-foreground md:p-8">
        <div className="text-sm text-primary-foreground/70">{c.code} · {classPath(c)}</div>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">{c.name}</h1>
        <p className="mt-2 max-w-2xl text-primary-foreground/80">{c.description}</p>
        <p className="mt-4 text-sm text-primary-foreground/70">{c.teacher?.full_name ? `Teacher: ${c.teacher.full_name}` : "No teacher assigned"}</p>
      </div>
      {!access.data ? (
        <Empty title="You're not a member of this class" text="Request access from Discover — the teacher will review it." action={<Button asChild><Link to="/discover">Go to Discover</Link></Button>} />
      ) : (
        <Tabs defaultValue="feed">
          <TabsList className="mb-6 w-full justify-start overflow-x-auto">
            <TabsTrigger value="feed">Feed</TabsTrigger>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="ai">AI Assistant</TabsTrigger>
          </TabsList>
          <TabsContent value="feed"><Feed classId={classId} canManage={canManage} userId={me.id} /></TabsContent>
          <TabsContent value="subjects"><Subjects classId={classId} canManage={canManage} /></TabsContent>
          <TabsContent value="people"><People classId={classId} teacher={c.teacher?.full_name} canManage={canManage} /></TabsContent>
          <TabsContent value="files"><Files classId={classId} isAdmin={me.role === "admin"} userId={me.id} /></TabsContent>
          <TabsContent value="ai"><Assistant classId={classId} /></TabsContent>
        </Tabs>
      )}
    </>
  );
}

const TYPE_ICON = { announcement: Megaphone, assignment: ClipboardList, resource: FileText, link: Link2 } as const;
type PostType = keyof typeof TYPE_ICON;

function Feed({ classId, canManage, userId }: { classId: string; canManage: boolean; userId: string }) {
  const qc = useQueryClient();
  const [type, setType] = useState<PostType>("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [due, setDue] = useState("");
  const posts = useQuery({
    queryKey: ["posts", classId],
    queryFn: async () => (await supabase.from("posts").select("*, author:profiles(full_name)").eq("class_id", classId).order("created_at", { ascending: false })).data ?? [],
  });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posts").insert({ class_id: classId, author_id: userId, type, title, body, url: url || null, due_at: due ? new Date(due).toISOString() : null });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setBody(""); setUrl(""); setDue(""); toast.success("Posted"); qc.invalidateQueries({ queryKey: ["posts", classId] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("posts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts", classId] }),
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <div className="flex gap-3">
              <Select value={type} onValueChange={(v) => setType(v as PostType)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(TYPE_ICON).map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
              <Input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <Textarea placeholder="Write something for the class…" value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap gap-3">
              {(type === "link" || type === "resource") && <Input className="flex-1" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />}
              {type === "assignment" && <Input className="w-56" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />}
              <Button className="ml-auto" disabled={create.isPending}><Send className="mr-1 h-4 w-4" /> Post</Button>
            </div>
          </form>
        </Card>
      )}
      {!posts.data?.length ? <Empty title="No posts yet" text="Announcements and assignments will appear here." /> : posts.data.map((p) => {
        const Icon = TYPE_ICON[p.type as PostType];
        return (
          <Card key={p.id}>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{p.title}</h3>
                  {canManage && <button onClick={() => del.mutate(p.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete post"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <div className="text-xs capitalize text-muted-foreground">{p.type} · {(p.author as { full_name: string } | null)?.full_name} · {timeAgo(p.created_at)}</div>
                {p.body && <p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p>}
                {p.due_at && <p className="mt-2 text-sm font-medium text-primary">Due {new Date(p.due_at).toLocaleString()}</p>}
                {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary"><ExternalLink className="h-3.5 w-3.5" /> {p.url}</a>}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Subjects({ classId, canManage }: { classId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const units = useQuery({
    queryKey: ["units", classId],
    queryFn: async () => (await supabase.from("units").select("*, unit_items(*)").eq("class_id", classId).order("position").order("created_at")).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["units", classId] });
  const addUnit = async () => {
    const { error } = await supabase.from("units").insert({ class_id: classId, title, position: (units.data?.length ?? 0) + 1 });
    if (error) return toast.error(error.message);
    setTitle(""); refresh();
  };
  const delUnit = async (id: string) => { await supabase.from("units").delete().eq("id", id); refresh(); };
  const delItem = async (id: string) => { await supabase.from("unit_items").delete().eq("id", id); refresh(); };

  return (
    <div className="space-y-4">
      {canManage && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title) addUnit(); }}>
          <Input placeholder="New unit or module, e.g. Unit 1: Number Systems" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button><Plus className="mr-1 h-4 w-4" /> Add unit</Button>
        </form>
      )}
      {!units.data?.length ? <Empty title="No units yet" text="Units, notes and links will appear here." /> : units.data.map((u) => (
        <Card key={u.id}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{u.title}</h3>
            {canManage && <div className="flex gap-1"><AddItem unitId={u.id} onDone={refresh} /><Button variant="ghost" size="icon" onClick={() => delUnit(u.id)} aria-label="Delete unit"><Trash2 className="h-4 w-4" /></Button></div>}
          </div>
          <ul className="mt-3 space-y-2">
            {(u.unit_items ?? []).map((i) => (
              <li key={i.id} className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
                {i.kind === "link" ? <Link2 className="mt-0.5 h-4 w-4 text-primary" /> : <NotebookPen className="mt-0.5 h-4 w-4 text-primary" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{i.url ? <a href={i.url} target="_blank" rel="noreferrer" className="hover:text-primary">{i.title}</a> : i.title}</div>
                  {i.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{i.body}</p>}
                </div>
                {canManage && <button onClick={() => delItem(i.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete item"><Trash2 className="h-4 w-4" /></button>}
              </li>
            ))}
            {!u.unit_items?.length && <li className="text-sm text-muted-foreground">No notes yet.</li>}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function AddItem({ unitId, onDone }: { unitId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"note" | "link">("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("unit_items").insert({ unit_id: unitId, kind, title, body, url: kind === "link" ? url : null });
    if (error) return toast.error(error.message);
    setTitle(""); setBody(""); setUrl(""); setOpen(false); onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="sm"><Plus className="mr-1 h-4 w-4" /> Add</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add to unit</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Select value={kind} onValueChange={(v) => setKind(v as "note" | "link")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="note">Note</SelectItem><SelectItem value="link">Link</SelectItem></SelectContent>
          </Select>
          <Input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          {kind === "link" && <Input required type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />}
          <Textarea placeholder={kind === "note" ? "Notes content" : "Description (optional)"} rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button className="w-full">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function People({ classId, teacher, canManage }: { classId: string; teacher?: string; canManage: boolean }) {
  const qc = useQueryClient();
  const members = useQuery({
    queryKey: ["members", classId],
    queryFn: async () => (await supabase.from("class_members").select("user_id, joined_at, profile:profiles(full_name, email)").eq("class_id", classId)).data ?? [],
  });
  const remove = async (uid: string) => {
    const { error } = await supabase.from("class_members").delete().eq("class_id", classId).eq("user_id", uid);
    if (error) return toast.error(error.message);
    toast.success("Member removed"); qc.invalidateQueries({ queryKey: ["members", classId] });
  };
  return (
    <div className="space-y-6">
      <Card><div className="text-xs font-semibold uppercase text-muted-foreground">Teacher</div><div className="mt-2 font-medium">{teacher ?? "Not assigned"}</div></Card>
      <Card>
        <div className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Students ({members.data?.length ?? 0})</div>
        {!members.data?.length ? <p className="text-sm text-muted-foreground">No students yet.</p> : (
          <ul className="divide-y">
            {members.data.map((m) => {
              const p = m.profile as { full_name: string; email: string | null } | null;
              return (
                <li key={m.user_id} className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">{initials(p?.full_name ?? "?")}</div>
                  <div className="flex-1"><div className="text-sm font-medium">{p?.full_name}</div><div className="text-xs text-muted-foreground">{p?.email}</div></div>
                  {canManage && <Button variant="ghost" size="sm" onClick={() => remove(m.user_id)}>Remove</Button>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Files({ classId, isAdmin, userId }: { classId: string; isAdmin: boolean; userId: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const files = useQuery({
    queryKey: ["files", classId],
    queryFn: async () => (await supabase.from("files").select("*").eq("class_id", classId).order("created_at", { ascending: false })).data ?? [],
  });
  const upload = async (file: File) => {
    setUploading(true);
    const path = `${classId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("class-files").upload(path, file, { contentType: file.type });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { error: e2 } = await supabase.from("files").insert({ class_id: classId, uploaded_by: userId, name: file.name, storage_path: path, size_bytes: file.size, mime_type: file.type });
    setUploading(false);
    if (e2) { await supabase.storage.from("class-files").remove([path]); return toast.error(e2.message); }
    toast.success("File uploaded"); qc.invalidateQueries({ queryKey: ["files", classId] });
  };
  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("class-files").createSignedUrl(path, 60);
    if (error || !data) return toast.error(error?.message ?? "Could not open file");
    window.open(data.signedUrl, "_blank");
  };
  const remove = async (id: string, path: string) => {
    const { error } = await supabase.storage.from("class-files").remove([path]);
    if (error) return toast.error(error.message);
    await supabase.from("files").delete().eq("id", id);
    toast.success("File deleted"); qc.invalidateQueries({ queryKey: ["files", classId] });
  };
  return (
    <div className="space-y-4">
      {isAdmin ? (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed bg-card p-6 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary">
          <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload official file"}
          <input type="file" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </label>
      ) : <p className="text-sm text-muted-foreground">Official files are published by administrators.</p>}
      {!files.data?.length ? <Empty title="No files yet" /> : (
        <div className="divide-y rounded-2xl border bg-card">
          {files.data.map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-primary" />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{f.name}</div><div className="text-xs text-muted-foreground">{(f.size_bytes / 1024).toFixed(0)} KB · {timeAgo(f.created_at)}</div></div>
              <Button variant="ghost" size="icon" onClick={() => download(f.storage_path)} aria-label="Download"><Download className="h-4 w-4" /></Button>
              {isAdmin && <Button variant="ghost" size="icon" onClick={() => remove(f.id, f.storage_path)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Msg = { role: "user" | "assistant"; content: string };
function Assistant({ classId }: { classId: string }) {
  const ask = useServerFn(askAssistant);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    const question = q; setQ(""); setBusy(true);
    const history = msgs.slice(-10);
    setMsgs((m) => [...m, { role: "user", content: question }]);
    try {
      const r = await ask({ data: { classId, question, history } });
      if (r.error) toast.error(r.error);
      else setMsgs((m) => [...m, { role: "assistant", content: r.answer }]);
    } catch (err) { toast.error((err as Error).message); }
    setBusy(false);
  };
  return (
    <Card className="flex h-[60vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {msgs.length === 0 && <p className="text-sm text-muted-foreground">Ask about this class — answers are grounded in its posts, units and notes you're authorized to see.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>{m.content}</div>
        ))}
        {busy && <div className="w-fit rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">Thinking…</div>}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t pt-4">
        <Input placeholder="e.g. Summarise Unit 1" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button disabled={busy}><Send className="h-4 w-4" /></Button>
      </form>
    </Card>
  );
}
