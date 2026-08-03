import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { SkeletonCard } from "@/components/app/Skeletons";
import { School } from "lucide-react";

export const Route = createFileRoute("/_authenticated/communities")({
  head: () => ({
    meta: [
      { title: "School Communities — SchoolConnect" },
      { name: "description", content: "Browse school communities, see members, events and announcements from every school on SchoolConnect." },
      { property: "og:title", content: "School Communities — SchoolConnect" },
      { property: "og:description", content: "Every school, grouped automatically." },
    ],
  }),
  component: CommunitiesPage,
});

function CommunitiesPage() {
  const [rows, setRows] = useState<{ slug: string; name: string; members: number }[] | null>(null);
  const [mine, setMine] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: me } = await supabase.from("profiles").select("school_slug").eq("id", u.user.id).maybeSingle();
        setMine(me?.school_slug ?? null);
      }
      const { data } = await supabase.from("profiles").select("school_slug,school_name");
      const c: Record<string, { name: string; n: number }> = {};
      (data ?? []).forEach((p: any) => {
        if (!p.school_slug) return;
        c[p.school_slug] = { name: p.school_name ?? p.school_slug, n: (c[p.school_slug]?.n ?? 0) + 1 };
      });
      setRows(Object.entries(c).map(([slug, v]) => ({ slug, name: v.name, members: v.n })).sort((a, b) => b.members - a.members));
    })();
  }, []);

  return (
    <AppShell>
      <header className="glass flex items-center gap-3 rounded-2xl p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary"><School className="h-5 w-5 text-primary-foreground" /></span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">School Communities</h1>
          <p className="text-sm text-muted-foreground">Students are grouped automatically by school name.</p>
        </div>
      </header>

      <div className="mt-4 grid gap-3">
        {!rows ? [0, 1, 2].map((i) => <SkeletonCard key={i} lines={1} />) : rows.length === 0 ? (
          <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No schools yet — add your school in your profile.</p>
        ) : rows.map((r) => (
          <Link key={r.slug} to="/communities/$slug" params={{ slug: r.slug }} className="glass hover-lift flex items-center gap-3 rounded-2xl p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card text-sm font-black text-primary">{r.name.slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.members} member{r.members === 1 ? "" : "s"}{mine === r.slug ? " · your school" : ""}</div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
