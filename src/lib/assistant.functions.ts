import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  classId: z.string().uuid(),
  question: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20),
});

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // All reads run as the user, so RLS guarantees only authorized material is used.
    const { data: allowed } = await sb.rpc("can_access_class", { _class: data.classId, _user: context.userId });
    if (!allowed) return { answer: "", error: "You don't have access to this class." };

    const [cls, posts, units, files] = await Promise.all([
      sb.from("classes").select("name, code, description").eq("id", data.classId).maybeSingle(),
      sb.from("posts").select("type, title, body, url, due_at").eq("class_id", data.classId).order("created_at", { ascending: false }).limit(50),
      sb.from("units").select("title, description, unit_items(kind, title, body, url)").eq("class_id", data.classId).order("position"),
      sb.from("files").select("name").eq("class_id", data.classId),
    ]);

    const material = [
      `CLASS: ${cls.data?.code} ${cls.data?.name} — ${cls.data?.description}`,
      "POSTS:",
      ...(posts.data ?? []).map((p) => `- [${p.type}] ${p.title}${p.due_at ? ` (due ${p.due_at})` : ""}: ${p.body}${p.url ? ` <${p.url}>` : ""}`),
      "UNITS:",
      ...(units.data ?? []).map((u) =>
        `## ${u.title}: ${u.description}\n` +
        ((u.unit_items as { kind: string; title: string; body: string; url: string | null }[]) ?? []).map((i) => `  - ${i.title}: ${i.body}${i.url ? ` <${i.url}>` : ""}`).join("\n"),
      ),
      "OFFICIAL FILES: " + ((files.data ?? []).map((f) => f.name).join(", ") || "none"),
    ].join("\n").slice(0, 60000);

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { answer: "", error: "AI is not configured." };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are the CampusOS study assistant. Answer using the class material below. If the material doesn't cover the question, say so clearly, then give brief general guidance labelled as general knowledge. Be concise and use markdown.\n\n" + material,
          },
          ...data.history,
          { role: "user", content: data.question },
        ],
      }),
    });
    if (res.status === 429) return { answer: "", error: "Too many requests — please wait a moment." };
    if (res.status === 402) return { answer: "", error: "AI credits are exhausted for this workspace." };
    if (!res.ok) {
      console.error("AI error", res.status, await res.text());
      return { answer: "", error: "The assistant is unavailable right now." };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { answer: json.choices?.[0]?.message?.content ?? "", error: null as string | null };
  });
