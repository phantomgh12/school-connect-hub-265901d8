import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import {
  claimMission, dailySpin, fetchGamState, fetchMissions, levelProgress, openBox,
  SPIN_SEGMENTS, type GamState, type MissionRow,
} from "@/lib/gamification";
import {
  Coins, Flame, Gift, Loader2, Sparkles, Swords, Trophy, Zap, ShoppingBag, Award,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards, missions & School Wars — GH School Hub" },
      { name: "description", content: "Spin daily, finish missions, open mystery boxes, earn XP and coins, and win School Wars for your school." },
      { property: "og:title", content: "Rewards, missions & School Wars — GH School Hub" },
      { property: "og:description", content: "Daily spins, missions, mystery boxes, XP, coins and School Wars." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RewardsPage,
});

type Box = { id: string; name: string; description: string; cost_coins: number };
type WarScore = { school_slug: string; points: number };

function RewardsPage() {
  const [uid, setUid] = useState("");
  const [gam, setGam] = useState<GamState | null>(null);
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [war, setWar] = useState<{ title: string; ends_at: string } | null>(null);
  const [scores, setScores] = useState<WarScore[]>([]);
  const [season, setSeason] = useState<{ name: string; description: string; ends_at: string | null } | null>(null);
  const [mySlug, setMySlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const [g, m, { data: b }, { data: w }, { data: s }, { data: prof }] = await Promise.all([
      fetchGamState(id),
      fetchMissions(id),
      supabase.from("reward_boxes").select("id,name,description,cost_coins").eq("active", true).order("cost_coins"),
      supabase.from("school_wars").select("id,title,ends_at").eq("active", true).order("starts_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("seasons").select("name,description,ends_at").eq("active", true).order("starts_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("school_slug").eq("id", id).maybeSingle(),
    ]);
    setGam(g);
    setMissions(m);
    setBoxes((b ?? []) as Box[]);
    setSeason((s as any) ?? null);
    setMySlug(prof?.school_slug ?? null);
    if (w) {
      setWar({ title: (w as any).title, ends_at: (w as any).ends_at });
      const { data: sc } = await supabase
        .from("school_war_scores").select("school_slug,points")
        .eq("war_id", (w as any).id).order("points", { ascending: false }).limit(10);
      setScores((sc ?? []) as WarScore[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      await load(u.user.id);
    })();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const canSpin = !!gam && gam.last_spin_date !== today;

  async function onSpin() {
    if (!canSpin || spinning) return;
    setSpinning(true);
    setSpinResult(null);
    try {
      const res = await dailySpin();
      if (!res?.ok) {
        toast.error(res?.error === "already_spun" ? "You already spun today — come back tomorrow." : "Spin failed");
        return;
      }
      const idx = Math.max(0, SPIN_SEGMENTS.indexOf(res.label.replace("JACKPOT ", "")));
      const seg = 360 / SPIN_SEGMENTS.length;
      setAngle((a) => a + 1440 + (360 - (idx * seg + seg / 2)) - (a % 360));
      setTimeout(async () => {
        setSpinResult(res.label);
        toast.success(`You won ${res.label}!`);
        await load(uid);
        setSpinning(false);
      }, 2600);
    } catch (e: any) {
      toast.error(e.message ?? "Spin failed");
      setSpinning(false);
    }
  }

  async function onClaim(m: MissionRow) {
    setBusy(m.id);
    try {
      const res = await claimMission(m.id);
      if (!res?.ok) toast.error(res?.error === "incomplete" ? "Not finished yet" : "Already claimed");
      else toast.success(`+${m.xp_reward} XP · +${m.coin_reward} coins`);
      await load(uid);
    } catch (e: any) {
      toast.error(e.message ?? "Could not claim");
    } finally {
      setBusy(null);
    }
  }

  async function onOpenBox(b: Box) {
    setBusy(b.id);
    try {
      const res = await openBox(b.id);
      if (!res?.ok) {
        toast.error(
          res?.error === "no_boxes" ? "No free boxes — spin or keep your streak alive."
            : res?.error === "not_enough_coins" ? "Not enough coins" : "Could not open",
        );
      } else {
        toast.success(`Box opened: ${res.reward?.label ?? "reward"}`);
      }
      await load(uid);
    } finally {
      setBusy(null);
    }
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

  const lp = levelProgress(gam?.xp ?? 0, gam?.level ?? 1);
  const daily = missions.filter((m) => m.cadence === "daily");
  const weekly = missions.filter((m) => m.cadence === "weekly");
  const seg = 360 / SPIN_SEGMENTS.length;

  return (
    <AppShell>
      <div className="grid gap-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border bg-card p-5 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black sm:text-2xl">Rewards</h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">Missions, spins, boxes and School Wars.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/shop" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
              <ShoppingBag className="h-4 w-4" /> Shop
            </Link>
            <Link to="/badges" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold hover:bg-muted">
              <Award className="h-4 w-4" /> Badges
            </Link>
          </div>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Zap} label="Level" value={String(gam?.level ?? 1)} sub={`${gam?.xp ?? 0} XP`} />
          <Stat icon={Coins} label="Coins" value={String(gam?.coins ?? 0)} sub="Spend in the shop" />
          <Stat icon={Flame} label="Streak" value={`${gam?.streak_days ?? 0}d`} sub={`Best ${gam?.longest_streak ?? 0}d`} />
          <Stat icon={Trophy} label="Reputation" value={String(gam?.reputation ?? 0)} sub={`${gam?.weekly_xp ?? 0} XP this week`} />
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span className="min-w-0 truncate">Level {gam?.level ?? 1} → {(gam?.level ?? 1) + 1}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{lp.remaining} XP to go</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${lp.pct}%` }} />
          </div>
        </section>

        {season && (
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-4 w-4" /> Season
            </div>
            <h2 className="mt-1 text-lg font-black">{season.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{season.description}</p>
            {season.ends_at && (
              <p className="mt-2 text-xs font-semibold text-muted-foreground">Ends {new Date(season.ends_at).toLocaleDateString()}</p>
            )}
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Spin wheel */}
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Gift className="h-4 w-4 text-primary" /> Daily spin
            </h2>
            <div className="mt-4 grid place-items-center gap-4">
              <div className="relative h-52 w-52 max-w-full">
                <div
                  className="h-full w-full rounded-full border-4 border-primary/20 transition-transform duration-[2500ms] ease-out"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    background: `conic-gradient(${SPIN_SEGMENTS.map((_, i) =>
                      `${i % 2 === 0 ? "var(--color-primary)" : "var(--color-muted)"} ${i * seg}deg ${(i + 1) * seg}deg`).join(",")})`,
                  }}
                />
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="grid h-20 w-20 place-items-center rounded-full border bg-card text-center text-[10px] font-bold leading-tight">
                    {spinning ? "…" : spinResult ?? "SPIN"}
                  </div>
                </div>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-primary">▼</div>
              </div>
              <button
                onClick={onSpin}
                disabled={!canSpin || spinning}
                className="w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {spinning ? "Spinning…" : canSpin ? "Spin now (free)" : "Come back tomorrow"}
              </button>
              <ul className="grid w-full grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                {SPIN_SEGMENTS.map((s) => <li key={s} className="min-w-0 truncate rounded-lg border px-2 py-1">{s}</li>)}
              </ul>
            </div>
          </section>

          {/* Boxes */}
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Gift className="h-4 w-4 text-primary" /> Mystery boxes
              </h2>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{gam?.boxes_available ?? 0} free</span>
            </div>
            <ul className="mt-4 grid gap-3">
              {boxes.map((b) => (
                <li key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.description}</p>
                  </div>
                  <button
                    onClick={() => onOpenBox(b)}
                    disabled={busy === b.id}
                    className="shrink-0 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {busy === b.id ? "…" : b.cost_coins > 0 ? `${b.cost_coins} coins` : "Open free"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Missions */}
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Daily missions</h2>
          <MissionList rows={daily} busy={busy} onClaim={onClaim} />
          <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">Weekly missions</h2>
          <MissionList rows={weekly} busy={busy} onClaim={onClaim} />
        </section>

        {/* School Wars */}
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Swords className="h-4 w-4 text-primary" /> School Wars
          </h2>
          {!war ? (
            <p className="mt-3 text-sm text-muted-foreground">No war running right now. Next one starts soon.</p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <p className="min-w-0 truncate text-base font-black">{war.title}</p>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">Ends {new Date(war.ends_at).toLocaleDateString()}</span>
              </div>
              {scores.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No points yet — post, spin or finish a mission to score first for your school.</p>
              ) : (
                <ol className="mt-4 grid gap-2">
                  {scores.map((s, i) => (
                    <li key={s.school_slug} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 ${s.school_slug === mySlug ? "border-primary/50 bg-primary/5" : ""}`}>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-black">{i + 1}</span>
                      <span className="min-w-0 truncate text-sm font-semibold">{s.school_slug.replace(/-/g, " ")}</span>
                      <span className="shrink-0 text-sm font-black text-primary">{s.points}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function MissionList({ rows, busy, onClaim }: { rows: MissionRow[]; busy: string | null; onClaim: (m: MissionRow) => void }) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-muted-foreground">Nothing here yet.</p>;
  return (
    <ul className="mt-3 grid gap-2">
      {rows.map((m) => {
        const pct = Math.min(100, Math.round((m.progress / Math.max(m.goal, 1)) * 100));
        const done = m.progress >= m.goal;
        return (
          <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{m.title}</p>
              <p className="truncate text-xs text-muted-foreground">{m.description} · +{m.xp_reward} XP · +{m.coin_reward} coins</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <button
              onClick={() => onClaim(m)}
              disabled={!done || m.claimed || busy === m.id}
              className="shrink-0 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40"
            >
              {m.claimed ? "Claimed" : done ? (busy === m.id ? "…" : "Claim") : `${m.progress}/${m.goal}`}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
