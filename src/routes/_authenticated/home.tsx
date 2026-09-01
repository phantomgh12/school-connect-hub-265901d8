import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { CreatePost } from "@/components/app/CreatePost";
import { PostCard, type FeedPost } from "@/components/app/PostCard";
import { StoryRail } from "@/components/app/StoryRail";
import { SkeletonPost, SkeletonCard } from "@/components/app/Skeletons";
import { NetworkStatsCard, SchoolCommunityCard } from "@/components/app/NetworkPanels";
import { DailyRewardsCard, ReferralProgressCard, SchoolRankingsCard, TrendingCard, UpcomingEventsCard, SuggestedFriendsCard } from "@/components/app/SidePanels";
import { fetchFeedPage, loadViewerContext, postPrompts, type FeedTab, type ViewerContext } from "@/lib/feed";
import { School, Sparkles, UserCheck, Flame, Clock } from "lucide-react";

type Search = { tab?: FeedTab };

export const Route = createFileRoute("/_authenticated/home")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: (["foryou", "following", "trending", "latest"] as const).includes(s["tab"] as FeedTab) ? (s["tab"] as FeedTab) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Home Feed — SchoolConnect" },
      { name: "description", content: "Your personalised student feed: For You, Following, Trending and Latest posts from your school community." },
      { property: "og:title", content: "Home Feed — SchoolConnect" },
      { property: "og:description", content: "A personalised feed for students and alumni." },
    ],
  }),
  component: HomePage,
});

const TABS: { key: FeedTab; label: string; icon: typeof Sparkles }[] = [
  { key: "foryou", label: "For You", icon: Sparkles },
  { key: "following", label: "Following", icon: UserCheck },
  { key: "trending", label: "Trending", icon: Flame },
  { key: "latest", label: "Latest", icon: Clock },
];

function HomePage() {
  const { tab = "foryou" } = Route.useSearch();
  const nav = Route.useNavigate();
  const [uid, setUid] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [ctx, setCtx] = useState<ViewerContext | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      const [{ data: p }, c] = await Promise.all([
        supabase.from("profiles").select("full_name,avatar_url,school_name,school_slug").eq("id", u.user.id).maybeSingle(),
        loadViewerContext(u.user.id),
      ]);
      setProfile(p);
      setCtx(c);
      supabase.rpc("touch_streak").then(() => {});
    })();
  }, []);

  const loadPage = useCallback(async (p: number, replace: boolean) => {
    if (!ctx) return;
    const res = await fetchFeedPage(tab, ctx, p);
    setPosts((prev) => (replace ? res.posts : [...prev, ...res.posts.filter((x) => !prev.some((y) => y.id === x.id))]));
    setHasMore(res.hasMore);
    setLoading(false);
    setLoadingMore(false);
  }, [ctx, tab]);

  useEffect(() => {
    if (!ctx) return;
    setLoading(true);
    setPage(0);
    loadPage(0, true);
  }, [ctx, tab, loadPage]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && !loadingMore) {
        setLoadingMore(true);
        const next = page + 1;
        setPage(next);
        loadPage(next, false);
      }
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, page, loadPage]);

  // Realtime: new posts refresh the top of the feed
  useEffect(() => {
    if (!uid) return;
    const ch = supabase.channel(`feed-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => loadPage(0, true))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, () => loadPage(0, true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, loadPage]);

  const refresh = () => loadPage(0, true);
  const prompts = postPrompts(uid || "a", profile?.school_name);

  return (
    <AppShell
      right={
        <>
          <DailyRewardsCard />
          <TrendingCard />
          <SuggestedFriendsCard uid={uid} />
          <SchoolRankingsCard />
          <UpcomingEventsCard />
          <ReferralProgressCard uid={uid} />
          {uid && <NetworkStatsCard userId={uid} />}
          {uid && <SchoolCommunityCard userId={uid} />}
        </>
      }
    >
      {uid && <StoryRail userId={uid} avatarUrl={profile?.avatar_url ?? null} />}

      {/* What's happening at your school */}
      <WhatsHappening schoolSlug={profile?.school_slug ?? null} schoolName={profile?.school_name ?? null} uid={uid} />

      {uid && <CreatePost userId={uid} avatarUrl={profile?.avatar_url ?? null} onPosted={refresh} />}

      {/* Feed tabs */}
      <div className="glass sticky top-14 z-30 mt-4 flex gap-1 overflow-x-auto rounded-2xl p-1.5 no-scrollbar">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => nav({ search: { tab: t.key }, replace: true })}
              className={`press flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                active ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="mt-4 grid gap-4">{[0, 1, 2].map((i) => <SkeletonPost key={i} />)}</div>
      ) : posts.length === 0 ? (
        <div className="glass mt-4 rounded-2xl p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary shadow-soft"><Sparkles className="h-6 w-6 text-primary-foreground" /></div>
          <h3 className="mt-4 text-lg font-bold">{tab === "following" ? "Follow classmates to fill this tab" : "Nothing here yet"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try one of these to get started:</p>
          <ul className="mt-3 grid gap-2 text-left">
            {prompts.map((p) => (
              <li key={p}>
                <Link to="/new-post" className="block rounded-xl border bg-card px-3 py-2.5 text-sm font-medium hover-lift">{p}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          {posts.map((p) => <PostCard key={p.id} post={p} currentUserId={uid} onChange={refresh} />)}
          {hasMore && <div ref={sentinel}>{loadingMore && <SkeletonPost />}</div>}
        </div>
      )}
    </AppShell>
  );
}

function WhatsHappening({ schoolSlug, schoolName, uid }: { schoolSlug: string | null; schoolName: string | null; uid: string }) {
  const [data, setData] = useState<{ members: number; posts: number; online: number; events: any[] } | null>(null);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const base = supabase.from("profiles").select("id", { count: "exact", head: true });
      const [{ count: members }, { count: online }, { data: events }] = await Promise.all([
        schoolSlug ? base.eq("school_slug", schoolSlug) : base,
        schoolSlug
          ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("school_slug", schoolSlug).eq("is_online", true)
          : supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_online", true),
        supabase.from("school_events").select("id,title,starts_at").gte("starts_at", new Date().toISOString()).order("starts_at").limit(2),
      ]);
      const { count: posts } = await supabase.from("posts").select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
      setData({ members: members ?? 0, posts: posts ?? 0, online: online ?? 0, events: events ?? [] });
    })();
  }, [schoolSlug, uid]);

  if (!data) return <div className="mt-4"><SkeletonCard lines={1} /></div>;

  return (
    <section className="glass mt-4 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary"><School className="h-4 w-4 text-primary-foreground" /></span>
        <h2 className="min-w-0 truncate text-base font-black">What's happening at {schoolName || "your school"}?</h2>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Members", value: data.members },
          { label: "Online now", value: data.online },
          { label: "Posts today", value: data.posts },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3 text-center">
            <div className="text-lg font-black text-primary">{s.value}</div>
            <div className="text-[11px] font-medium text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      {data.events.length > 0 && (
        <ul className="mt-3 grid gap-1.5">
          {data.events.map((e) => (
            <li key={e.id}>
              <Link to="/events" className="flex items-center justify-between rounded-xl px-2 py-1.5 text-sm hover:bg-muted">
                <span className="min-w-0 truncate font-semibold">{e.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(e.starts_at).toLocaleDateString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/communities" className="press rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground">Open community</Link>
        <Link to="/confessions" className="press rounded-full border px-3.5 py-1.5 text-xs font-bold hover:bg-muted">Confessions</Link>
        <Link to="/events" className="press rounded-full border px-3.5 py-1.5 text-xs font-bold hover:bg-muted">Events</Link>
      </div>
    </section>
  );
}
