import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Award, Loader2, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/badges")({
  head: () => ({
    meta: [
      { title: "Badge wall — GH School Hub" },
      { name: "description", content: "Every badge on GH School Hub: what you have earned, what is still locked, and how much XP each one is worth." },
      { property: "og:title", content: "Badge wall — GH School Hub" },
      { property: "og:description", content: "Track every badge you have earned and what is still locked." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BadgeWallPage,
});

type Achievement = { key: string; title: string; description: string; xp: number; icon: string };

function BadgeWallPage() {
  const [all, setAll] = useState<Achievement[]>([]);
  const [earned, setEarned] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: a }, { data: mine }] = await Promise.all([
        supabase.from("achievements").select("key,title,description,xp,icon").order("xp"),
        supabase.from("user_achievements").select("achievement_key,earned_at").eq("user_id", u.user.id),
      ]);
      setAll((a ?? []) as Achievement[]);
      setEarned(new Map((mine ?? []).map((m: any) => [m.achievement_key, m.earned_at])));
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="grid h-64 place-items-center rounded-2xl border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const list = all.filter((b) =>
    filter === "all" ? true : filter === "earned" ? earned.has(b.key) : !earned.has(b.key),
  );
  const earnedXp = all.filter((b) => earned.has(b.key)).reduce((s, b) => s + b.xp, 0);

  return (
    <AppShell>
      <div className="grid gap-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border bg-card p-5">
          <div className="min-w-0">
            <h1 className="flex min-w-0 items-center gap-2 truncate text-xl font-black sm:text-2xl">
              <Award className="h-5 w-5 shrink-0 text-primary" /> Badge wall
            </h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{earned.size} of {all.length} earned · {earnedXp} XP from badges</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {(["all", "earned", "locked"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${filter === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((b) => {
            const has = earned.has(b.key);
            return (
              <li key={b.key} className={`min-w-0 rounded-2xl border bg-card p-4 text-center ${has ? "" : "opacity-50"}`}>
                <div className="grid h-12 place-items-center text-3xl leading-none">
                  {has ? b.icon : <Lock className="h-5 w-5" />}
                </div>
                <p className="mt-1 truncate text-sm font-bold">{b.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{b.description}</p>
                <p className="mt-1.5 text-[11px] font-bold text-primary">+{b.xp} XP</p>
                {has && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(earned.get(b.key)!).toLocaleDateString()}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
