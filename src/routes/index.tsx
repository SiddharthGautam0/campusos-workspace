import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bell, BookOpen, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CampusOS — One campus. Every class. One connected space." },
      { name: "description", content: "A permission-aware academic workspace for students, teachers and administrators." },
      { property: "og:title", content: "CampusOS — One connected academic space" },
      { property: "og:description", content: "Classes, announcements, study material, join requests and an AI study assistant in one secure workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ShieldCheck, title: "Permission-aware", text: "Every class, post and file is protected by role-based access rules." },
  { icon: Users, title: "Join requests", text: "Students request access, teachers approve. No one wanders in uninvited." },
  { icon: BookOpen, title: "Structured learning", text: "Course → Year → Section → Class, with units, notes and official files." },
  { icon: Bell, title: "Live notifications", text: "Approvals, announcements and assignments reach the right people instantly." },
  { icon: Sparkles, title: "AI study assistant", text: "Ask questions grounded only in the material of classes you belong to." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6">
        <section className="py-16 md:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> The academic workspace for modern colleges
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">
            One campus. Every class.<br />
            <span className="text-primary">One connected space.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            CampusOS brings courses, sections, classes, study material and people together — with access that
            matches how your college actually works.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/auth" search={{ mode: "signup" }}>Create your account <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild><Link to="/auth">I already have one</Link></Button>
          </div>
        </section>
        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
