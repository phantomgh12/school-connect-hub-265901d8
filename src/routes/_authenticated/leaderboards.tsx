import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { SkeletonCard } from "@/components/app/Skeletons";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboards")({
  head: () => ({
    meta: [
      { title: "Leaderboards — SchoolConnect" },
      { name: "description", content: "Top students, creators, schools and referrers ranked by XP, engagement and invites." },
      { property: "og:title", content: "Leaderboards — SchoolConnect" },
      { property: "og:description", content: "Top students, creators, schools and referrers." },
    ],
  }),
  component: LeaderboardsPage,
});

type Tab = "students" | "creators" | "schools" | "referrers";

function LeaderboardsPage() {
  const [tab, setTab] = useState<Tab>("students");
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    setRows(null);
    (async () => {
      if (tab === "students") {
        const { data } = await supabase.from("user_gamification").select("user_id,xp,level,streak_days").order("xp", { ascending: false }).limit(20);
        const ids = (data ?? []).map((d: any) => d.user_id);
        const { data: profs } = ids.length ? await supabase.from("profiles").select("id,full_name,avatar_url").in("id", ids) : { data: [] as any[] };
        const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
        setRows((data ?? []).map((d: any) => ({ id: d.user_id, name: m.get(d.user_id)?.full_name ?? "Student", avatar: m.get(d.user_id)?.avatar_url, value: `${d.xp} XP · Lv ${d.level}` })));
      } else if (tab === "creators") {
        const { data } = await supabase.from("posts").select("user_id,likes_count,comments_count,shares_count").limit(500);
        const t: Record<string, number> = {};
        (data ?? []).forEach((p: any) => { t[p.user_id] = (t[p.user_id] ?? 0) + p.likes_count + p.comments_count * 2 + p.shares_count * 3; });
        const top = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 20);
        const { data: profs } = top.length ? await supabase.from("profiles").select("id,full_name,avatar_url").in("id", top.map(([id]) => id)) : { data: [] as any[] };
        const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
        setRows(top.map(([id, score]) => ({ id, name: m.get(id)?.full_name ?? "Student", avatar: m.get(id)?.avatar_url, value: `${score} engagement` })));
      } else if (tab === "schools") {
        const { data } = await supabase.from("profiles").select("school_slug,school_name");
        const c: Record<string, { name: string; n: number }> = {};
        (data ?? []).forEach((p: any) => { if (p.school_slug) c[p.school_slug] = { name: p.school_name ?? p.school_slug, n: (c[p.school_slug]?.n ?? 0) + 1 }; });
        setRows(Object.entries(c).sort((a, b) => b[1].n - a[1].n).slice(0, 20).map(([slug, v]) => ({ id: slug, name: v.name, value: `${v.n} members`, school: true })));
      } else {
        const { data } = await supabase.from("invites").select("inviter_id,invitee_id").eq("confirmed", true);
        const c: Record<string, Set<string>> = {};
        (data ?? []).forEach((i: any) => { (c[i.inviter_id] ??= new Set()).add(i.invitee_id); });
        const top = Object.entries(c).map(([id, s]) => [id, s.size] as const).sort((a, b) => b[1] - a[1]).slice(0, 20);
        const { data: profs } = top.length ? await supabase.from("profiles").select("id,full_name,avatar_url").in("id", top.map(([id]) => id)) : { data: [] as any[] };
        const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
        setRows(top.map(([id, n]) => ({ id, name: m.get(id)?.full_name ?? "Student", avatar: m.get(id)?.avatar_url, value: `${n} invites` })));
      }
    })();
  }, [tab]);

  return (
    <AppShell>
      <header className="glass flex items-center gap-3 rounded-2xl p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary"><Trophy className="h-5 w-5 text-primary-foreground" /></span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">Leaderboards</h1>
          <p className="text-sm text-muted-foreground">XP, engagement and referrals.</p>
        </div>
      </header>

      <div className="glass mt-4 flex gap-1 overflow-x-auto rounded-2xl p-1.5 no-scrollbar">
        {(["students", "creators", "schools", "referrers"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`press flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{t}</button>
        ))}
      </div>

      <div className="mt-4">
        {!rows ? <SkeletonCard lines={4} /> : rows.length === 0 ? (
          <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Nothing to rank yet.</p>
        ) : (
          <ol className="glass grid gap-3 rounded-2xl p-4">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-card text-xs font-black">{i + 1}</span>
                {r.school ? (
                  <Link to="/communities/$slug" params={{ slug: r.id }} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">{r.name}</Link>
                ) : (
                  <>
                    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {r.avatar ? <img src={r.avatar} alt="" className="h-full w-full object-cover" loading="lazy" /> : (r.name || "S")[0]}
                    </span>
                    <Link to="/profile/$userId" params={{ userId: r.id }} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">{r.name}</Link>
                  </>
                )}
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">{r.value}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AppShell>
  );
}
