import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award, Lock } from "lucide-react";

type Achievement = { key: string; title: string; description: string; xp: number; icon: string };

/** Badge wall — every badge type, with earned tiers highlighted. */
export function BadgeGrid({ userId }: { userId: string }) {
  const [all, setAll] = useState<Achievement[]>([]);
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const [{ data: a }, { data: mine }] = await Promise.all([
        supabase.from("achievements").select("key,title,description,xp,icon").order("xp", { ascending: true }),
        supabase.from("user_achievements").select("achievement_key").eq("user_id", userId),
      ]);
      if (!alive) return;
      setAll((a ?? []) as Achievement[]);
      setEarned(new Set((mine ?? []).map((m: any) => m.achievement_key)));
    })();
    return () => { alive = false; };
  }, [userId]);

  if (!all.length) return null;

  const mineFirst = [...all].sort((x, y) => Number(earned.has(y.key)) - Number(earned.has(x.key)));
  const list = showAll ? mineFirst : mineFirst.slice(0, 18);

  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Award className="h-4 w-4 text-primary" /> Badges
        </h3>
        <span className="shrink-0 text-xs font-bold text-primary">{earned.size}/{all.length}</span>
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {list.map((b) => {
          const has = earned.has(b.key);
          return (
            <li
              key={b.key}
              title={`${b.title} — ${b.description} (+${b.xp} XP)`}
              className={`min-w-0 rounded-2xl border p-2 text-center ${has ? "bg-card" : "opacity-45"}`}
            >
              <div className="text-xl leading-none">{has ? b.icon : <Lock className="mx-auto h-4 w-4" />}</div>
              <p className="mt-1 truncate text-[10px] font-semibold">{b.title}</p>
            </li>
          );
        })}
      </ul>

      {all.length > 18 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-3 w-full rounded-full px-3 py-2 text-xs font-bold text-primary hover:bg-muted">
          {showAll ? "Show less" : `Show all ${all.length} badges`}
        </button>
      )}
    </section>
  );
}
