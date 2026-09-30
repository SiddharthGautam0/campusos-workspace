import { supabase } from "@/integrations/supabase/client";

export const CLASS_SELECT =
  "id, name, code, description, teacher_id, teacher:profiles!classes_teacher_id_fkey(full_name), section:sections(id, name, year:years(id, label, course:courses(id, name, code)))";

export type ClassRow = {
  id: string;
  name: string;
  code: string;
  description: string;
  teacher_id: string | null;
  teacher: { full_name: string } | null;
  section: { id: string; name: string; year: { id: string; label: string; course: { id: string; name: string; code: string } } };
};

/** Classes the user teaches or is a member of (admins see all). */
export async function fetchMyClasses(userId: string, role: string): Promise<ClassRow[]> {
  if (role === "admin") {
    const { data } = await supabase.from("classes").select(CLASS_SELECT).order("name");
    return (data ?? []) as unknown as ClassRow[];
  }
  const { data: mem } = await supabase.from("class_members").select("class_id").eq("user_id", userId);
  const ids = (mem ?? []).map((m) => m.class_id);
  let q = supabase.from("classes").select(CLASS_SELECT).order("name");
  q = ids.length ? q.or(`teacher_id.eq.${userId},id.in.(${ids.join(",")})`) : q.eq("teacher_id", userId);
  const { data } = await q;
  return (data ?? []) as unknown as ClassRow[];
}

export function classPath(c: ClassRow) {
  return `${c.section?.year?.course?.code ?? ""} · ${c.section?.year?.label ?? ""} · ${c.section?.name ?? ""}`;
}
