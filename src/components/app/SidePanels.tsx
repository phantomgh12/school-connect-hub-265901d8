import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SkeletonCard } from "@/components/app/Skeletons";
import { Flame, Trophy, CalendarDays, Gift, UserPlus, Users, School } from "lucide-react";

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="glass rounded-1xl p-5">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4" /> {title}
      </h3>
      {children}
    </section>
  );
}

export function TrendingCard() {
  const [tags, setTags] = useState<{ tag: string; count: number }[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("posts").select("hashtags").order("created_at", { ascending: false }).limit(200);
      const c: Record<string, number> = {};
      (data ?? []).forEach((p: any) => (p.hashtags ?? []).forEach((t: string) => { c[t] = (c[t] ?? 0) + 1; }));
      setTags(Object.entries(c).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 6));
    })();
  }, []);
  if (!tags) return <SkeletonCard lines={2} />;
  return (
    <Panel title="Trending" icon={Flame}>
      {tags.length === 0 ? <p className="text-sm text-muted-foreground">Post with #hashtags to start trends.</p> : (
        <ul className="grid gap-1.5">
          {tags.map((t) => (
            <li key={t.tag}>
              <Link to="/search" search={{ q: `#${t.tag}` }} className="flex items-center justify-between rounded-xl px-2 py-1.5 text-sm hover:bg-muted">
                <span className="min-w-0 truncate font-bold text-primary">#{t.tag}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to="/trending" className="mt-3 block text-xs font-bold text-primary">Open trending hub →</Link>
    </Panel>
  );
}

export function SuggestedFriendsCard({ uid }: { uid: string }) {
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data: me } = await supabase.from("profiles").select("school_slug").eq("id", uid).maybeSingle();
      const { data } = await supabase.from("profiles").select("id,full_name,username,avatar_url,school_name,school_slug")
        .neq("id", uid).limit(30);
      const ranked = (data ?? []).map((p: any) => ({ ...p, score: (p.school_slug && p.school_slug === me?.school_slug ? 10 : 0) + (p.avatar_url ? 1 : 0) }))
        .sort((a, b) => b.score - a.score).slice(0, 5);
      setList(ranked);
    })();
  }, [uid]);
  if (!list) return <SkeletonCard />;
  return (
    <Panel title="Suggested friends" icon={Users}>
      <ul className="grid gap-3">
        {list.length === 0 && <li className="text-sm text-muted-foreground">No suggestions yet.</li>}
        {list.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <Link to="/profile/$userId" params={{ userId: s.id }} className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {s.avatar_url ? <img src={s.avatar_url} className="h-full w-full object-cover" alt="" loading="lazy" /> : (s.full_name || "S")[0]}
            </Link>
            <div className="min-w-0 flex-1">
              <Link to="/profile/$userId" params={{ userId: s.id }} className="block truncate text-sm font-semibold hover:underline">{s.full_name || s.username || "Student"}</Link>
              <div className="truncate text-xs text-muted-foreground">{s.school_name ?? "SchoolConnect"}</div>
            </div>
            <Link to="/friends" className="press rounded-full border p-1.5 hover:bg-muted" title="Find friends"><UserPlus className="h-3.5 w-3.5" /></Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function SchoolRankingsCard() {
  const [rows, setRows] = useState<{ slug: string; name: string; score: number }[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("school_slug,school_name");
      const c: Record<string, { name: string; n: number }> = {};
      (data ?? []).forEach((p: any) => {
        if (!p.school_slug) return;
        c[p.school_slug] = { name: p.school_name ?? p.school_slug, n: (c[p.school_slug]?.n ?? 0) + 1 };
      });
      setRows(Object.entries(c).map(([slug, v]) => ({ slug, name: v.name, score: v.n })).sort((a, b) => b.score - a.score).slice(0, 5));
    })();
  }, []);
  if (!rows) return <SkeletonCard lines={2} />;
  return (
    <Panel title="School rankings" icon={Trophy}>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No schools ranked yet.</p> : (
        <ol className="grid gap-1.5">
          {rows.map((r, i) => (
            <li key={r.slug}>
              <Link to="/communities" className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-muted">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-card text-xs font-black">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.score}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <Link to="/leaderboards" className="mt-3 block text-xs font-bold text-primary">All leaderboards →</Link>
    </Panel>
  );
}

export function UpcomingEventsCard() {
  const [events, setEvents] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("school_events").select("id,title,starts_at,location")
        .gte("starts_at", new Date().toISOString()).order("starts_at").limit(4);
      setEvents(data ?? []);
    })();
  }, []);
  if (!events) return <SkeletonCard lines={2} />;
  return (
    <Panel title="Upcoming events" icon={CalendarDays}>
      {events.length === 0 ? <p className="text-sm text-muted-foreground">No events yet. <Link to="/events" className="font-bold text-primary">Create one</Link>.</p> : (
        <ul className="grid gap-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link to="/events" className="block rounded-xl px-2 py-1.5 hover:bg-muted">
                <div className="truncate text-sm font-semibold">{e.title}</div>
                <div className="truncate text-xs text-muted-foreground">{new Date(e.starts_at).toLocaleString()}{e.location ? ` · ${e.location}` : ""}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ReferralProgressCard({ uid }: { uid: string }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!uid) return;
    supabase.from("invites").select("invitee_id").eq("inviter_id", uid).eq("confirmed", true)
      .then(({ data }) => setN(new Set((data ?? []).map((i: any) => i.invitee_id)).size));
  }, [uid]);
  if (n === null) return <SkeletonCard lines={1} />;
  const pct = Math.min((n / 50) * 100, 100);
  return (
    <Panel title="Referral progress" icon={School}>
      <p className="text-sm font-semibold">{n} of 50 confirmed invites</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-card">
        <div className="h-full rounded-full bg-[color:var(--success)] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Rewards: XP at every invite, badges at 5 and 50, plus a verified route.</p>
      <Link to="/verification" className="mt-3 block text-xs font-bold text-primary">Get your invite link →</Link>
    </Panel>
  );
}

export function DailyRewardsCard() {
  const [g, setG] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase.rpc("touch_streak");
      const { data } = await supabase.from("user_gamification").select("xp,level,streak_days,longest_streak").eq("user_id", u.user.id).maybeSingle();
      setG(data);
    })();
  }, []);
  if (!g) return <SkeletonCard lines={1} />;
  const next = Math.pow(g.level, 2) * 100;
  const pct = Math.min((g.xp / Math.max(next, 1)) * 100, 100);
  return (
    <Panel title="Daily rewards" icon={Gift}>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-1xl bg-[color:var(--trending)] text-lg font-black text-[color:var(--trending-foreground)]">
          {g.streak_days}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{g.streak_days}-day streak 🔥</p>
          <p className="truncate text-xs text-muted-foreground">Level {g.level} · {g.xp} XP · best {g.longest_streak}d</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-card">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <Link to="/leaderboards" className="mt-3 block text-xs font-bold text-primary">See leaderboards →</Link>
    </Panel>
  );
}
