import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { CreatePost } from "@/components/app/CreatePost";
import { PostCard, type FeedPost } from "@/components/app/PostCard";
import { TrendingUp, Users, Plus, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — SchoolConnect" }] }),
  component: HomePage,
});

function HomePage() {
  const [userId, setUserId] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [, setProfileName] = useState<string>("");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([]);

  const loadFeed = useCallback(async (uid: string) => {
    const { data: rawPosts } = await supabase
      .from("posts")
      .select("id,user_id,content,media_urls,post_type,hashtags,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const ids = (rawPosts ?? []).map((p: any) => p.id);
    const authorIds = [...new Set((rawPosts ?? []).map((p: any) => p.user_id))];
    const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];
    const [{ data: likes }, { data: comments }, { data: myLikes }, { data: mySaves }, { data: authors }] = await Promise.all([
      supabase.from("post_likes").select("post_id").in("post_id", safeIds),
      supabase.from("post_comments").select("post_id").in("post_id", safeIds),
      supabase.from("post_likes").select("post_id").eq("user_id", uid),
      supabase.from("post_saves").select("post_id").eq("user_id", uid),
      authorIds.length
        ? supabase.from("profiles").select("id,full_name,username,avatar_url,school_name").in("id", authorIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const authorMap = new Map((authors ?? []).map((a: any) => [a.id, a]));
    const likeCount: Record<string, number> = {};
    likes?.forEach((l: any) => { likeCount[l.post_id] = (likeCount[l.post_id] ?? 0) + 1; });
    const commentCount: Record<string, number> = {};
    comments?.forEach((c: any) => { commentCount[c.post_id] = (commentCount[c.post_id] ?? 0) + 1; });
    const likedSet = new Set(myLikes?.map((l: any) => l.post_id));
    const savedSet = new Set(mySaves?.map((s: any) => s.post_id));

    const feed: FeedPost[] = (rawPosts ?? []).map((p: any) => ({
      ...p,
      author: authorMap.get(p.user_id) ?? null,
      like_count: likeCount[p.id] ?? 0,
      comment_count: commentCount[p.id] ?? 0,
      liked_by_me: likedSet.has(p.id),
      saved_by_me: savedSet.has(p.id),
    }));
    setPosts(feed);

    // Trending hashtags
    const tagCount: Record<string, number> = {};
    feed.forEach((p) => p.hashtags.forEach((h) => { tagCount[h] = (tagCount[h] ?? 0) + 1; }));
    setTrending(Object.entries(tagCount).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 6));
  }, []);

  const loadSuggestions = useCallback(async (uid: string) => {
    const { data } = await supabase.from("profiles").select("id,full_name,username,avatar_url,school_name").neq("id", uid).limit(5);
    setSuggestions(data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      setUserId(uid);
      const { data: p } = await supabase.from("profiles").select("full_name,avatar_url").eq("id", uid).maybeSingle();
      setAvatarUrl(p?.avatar_url ?? null);
      setProfileName(p?.full_name ?? "");
      await Promise.all([loadFeed(uid), loadSuggestions(uid)]);
      setLoading(false);
    })();
  }, [loadFeed, loadSuggestions]);

  const refresh = () => userId && loadFeed(userId);

  return (
    <AppShell
      right={
        <>
          <div className="glass rounded-3xl p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Trending
            </h3>
            {trending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Post with #hashtags to start trends.</p>
            ) : (
              <ul className="grid gap-2">
                {trending.map((t) => (
                  <li key={t.tag} className="flex items-center justify-between rounded-xl px-2 py-1.5 text-sm hover:bg-muted">
                    <span className="font-semibold text-[color:var(--brand)]">#{t.tag}</span>
                    <span className="text-xs text-muted-foreground">{t.count} post{t.count > 1 ? "s" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass rounded-3xl p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Users className="h-4 w-4" /> Suggested friends
            </h3>
            <ul className="grid gap-3">
              {suggestions.length === 0 && <li className="text-sm text-muted-foreground">No suggestions yet.</li>}
              {suggestions.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-xs font-bold text-primary-foreground">
                    {s.avatar_url ? <img src={s.avatar_url} className="h-full w-full object-cover" alt="" /> : (s.full_name || "S")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.full_name || s.username || "Student"}</div>
                    <div className="truncate text-xs text-muted-foreground">{s.school_name ?? "SchoolConnect"}</div>
                  </div>
                  <button className="rounded-full border p-1.5 hover:bg-muted" title="Add friend"><Plus className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-3xl p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Coming soon
            </h3>
            <p className="text-xs text-muted-foreground">Stories, chat, friend requests and notifications land in Phase 2.</p>
          </div>
        </>
      }
    >
      {/* Stories rail placeholder */}
      <div className="glass mb-4 overflow-hidden rounded-3xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Stories</h2>
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Coming in Phase 2</span>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {["Add yours", "You", "Sam", "Ada", "Kojo", "Ama", "Emeka", "Nia"].map((n, i) => (
            <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1">
              <div className={`grid h-14 w-14 place-items-center rounded-full text-xs font-bold text-primary-foreground ${i === 0 ? "border-2 border-dashed border-[color:var(--brand)] bg-background text-[color:var(--brand)]" : "gradient-brand"}`}>
                {i === 0 ? <Plus className="h-5 w-5" /> : n[0]}
              </div>
              <span className="w-full truncate text-center text-[10px] font-semibold text-muted-foreground">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {userId && <CreatePost userId={userId} avatarUrl={avatarUrl} onPosted={refresh} />}

      {loading ? (
        <div className="mt-4 grid gap-4">
          {[0, 1, 2].map((i) => <SkeletonPost key={i} />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="glass mt-4 rounded-3xl p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-brand shadow-brand"><Sparkles className="h-6 w-6 text-primary-foreground" /></div>
          <h3 className="mt-4 text-lg font-bold">Your feed is empty</h3>
          <p className="mt-1 text-sm text-muted-foreground">Be the first to share something with your school community!</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          {posts.map((p) => <PostCard key={p.id} post={p} currentUserId={userId} onChange={refresh} />)}
        </div>
      )}
    </AppShell>
  );
}

function SkeletonPost() {
  return (
    <div className="glass animate-pulse rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 rounded bg-muted" />
          <div className="h-2 w-20 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
      </div>
      <div className="mt-4 h-40 rounded-xl bg-muted" />
    </div>
  );
}
