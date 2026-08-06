import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import {
  evaluateAchievements, fetchBadges, TIER_ORDER, TIER_STYLES,
  type Badge, type BadgeStats,
} from "@/lib/gamification";
import { Award, Loader2, Lock, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/badges")({
  head: () => ({
    meta: [
      { title: "Badge wall — 300 badges to earn | GH School Hub" },
      { name: "description", content: "All 300 GH School Hub badges across five tiers: see what you have earned, your live progress on every locked badge, and the XP and coins each one pays out." },
      { property: "og:title", content: "Badge wall — 300 badges to earn | GH School Hub" },
      { property: "og:description", content: "Track all 300 badges, your live progress, and the XP and coins each badge pays." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BadgeWallPage,
});

function BadgeWallPage() {
  const [all, setAll] = useState<Badge[]>([]);
  const [earned, setEarned] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState<BadgeStats>({});
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all");
  const [tier, setTier] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async (uid: string, announce: boolean) => {
    const res = await evaluateAchievements().catch(() => null);
    const [list, { data: mine }] = await Promise.all([
      fetchBadges(),
      supabase.from("user_achievements").select("achievement_key,earned_at").eq("user_id", uid),
    ]);
    setAll(list);
    setEarned(new Map((mine ?? []).map((m) => [m.achievement_key, m.earned_at])));
    if (res?.stats) setStats(res.stats);
    if (res?.earned?.length) {
      toast.success(
        res.earned.length === 1
          ? `Badge unlocked: ${res.earned[0]!.icon} ${res.earned[0]!.title}`
          : `${res.earned.length} new badges unlocked · +${res.xp} XP · +${res.coins} coins`,
      );
    } else if (announce) {
      toast.info("No new badges yet — keep posting, chatting and inviting.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await load(u.user.id, false);
      setLoading(false);
    })();
  }, [load]);

  async function recheck() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setChecking(true);
    try { await load(u.user.id, true); } finally { setChecking(false); }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="grid h-64 place-items-center rounded-2xl border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const list = all
    .filter((b) => (filter === "all" ? true : filter === "earned" ? earned.has(b.key) : !earned.has(b.key)))
    .filter((b) => (tier === "all" ? true : b.tier === tier));
  const earnedXp = all.filter((b) => earned.has(b.key)).reduce((s, b) => s + b.xp, 0);

  return (
    <AppShell>
      <div className="grid gap-5">
        <header className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <h1 className="flex min-w-0 items-center gap-2 text-xl font-black sm:text-2xl">
              <Award className="h-5 w-5 shrink-0 text-primary" /> Badge wall
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {earned.size} of {all.length} earned · {earnedXp} XP from badges
            </p>
          </div>
          <button
            onClick={recheck}
            disabled={checking}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} /> Check my badges
          </button>
        </header>

        <div className="grid gap-2">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {(["all", "earned", "locked"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${filter === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {(["all", ...TIER_ORDER] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold capitalize ${tier === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((b) => {
            const has = earned.has(b.key);
            const current = b.criteria_kind ? Number(stats[b.criteria_kind] ?? 0) : 0;
            const pct = b.criteria_value > 0 ? Math.min(100, Math.round((current / b.criteria_value) * 100)) : 0;
            return (
              <li key={b.key} className={`min-w-0 rounded-2xl border bg-card p-4 text-center ${TIER_STYLES[b.tier] ?? ""} ${has ? "" : "opacity-70"}`}>
                <div className="grid h-12 place-items-center text-3xl leading-none">
                  {has ? b.icon : <Lock className="h-5 w-5" />}
                </div>
                <p className="mt-1 truncate text-sm font-bold text-foreground">{b.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{b.description}</p>
                <p className="mt-1.5 text-[11px] font-bold text-primary">+{b.xp} XP · +{b.coin_reward} coins</p>
                {has ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Earned {new Date(earned.get(b.key)!).toLocaleDateString()}
                  </p>
                ) : b.criteria_kind && b.criteria_kind !== "early_rank" ? (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                      {current.toLocaleString()} / {b.criteria_value.toLocaleString()}
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
