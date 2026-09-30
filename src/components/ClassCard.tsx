import { Link } from "@tanstack/react-router";
import { classPath, type ClassRow } from "@/lib/queries";

export function ClassCard({ c }: { c: ClassRow }) {
  return (
    <Link to="/classes/$classId" params={{ classId: c.id }} className="group block rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{c.code}</span>
        <span className="text-xs text-muted-foreground">{classPath(c)}</span>
      </div>
      <h3 className="mt-3 font-semibold group-hover:text-primary">{c.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
      <p className="mt-4 text-xs text-muted-foreground">{c.teacher?.full_name ? `Taught by ${c.teacher.full_name}` : "No teacher assigned"}</p>
    </Link>
  );
}
