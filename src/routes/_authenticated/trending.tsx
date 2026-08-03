import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { PostCard, type FeedPost } from "@/components/app/PostCard";
import { SkeletonPost } from "@/components/app/Skeletons";
import { Flame } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trending")({
  head: () => ({
    meta: [
      { title: "Trending Hub — SchoolConnect" },
      { name: "description", content: "The hottest posts, hashtags, creators and schools on SchoolConnect right now." },
      { property: "og:title", content: "Trending Hub — SchoolConnect" },
      { property: "og:description", content: "Top hashtags, creators, schools and posts." },
    ],
  }),
  component: TrendingPage,
});

function TrendingPage() {
  const [uid, setUid] = useState("");
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [creators, setCreators] = useState<any[]>([]);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUid(u.user.id);
    const { data: raw } = await supabase.from("posts")
      .select("id,user_id,content,media_urls,post_type,hashtags,created_at,likes_count,comments_count,trending_score")
      .order("trending_score", { ascending: false }).limit(20);
    const ids = [...new Set((raw ?? []).map((p: any) => p.user_id))];
    const [{ data: authors }, { data: myLikes }, { data: mySaves }] = await Promise.all([
      ids.length ? supabase.from("profiles").select("id,full_name,username,avatar_url,school_name,verified").in("id", ids) : Promise.resolve({ data: [] as any[] }),
      supabase.from("post_likes").select("post_id").eq("user_id", u.user.id),
      supabase.from("post_saves").select("post_id").eq("user_id", u.user.id),
    ]);
    const amap = new Map((authors ?? []).map((a: any) => [a.id, a]));
    const liked = new Set((myLikes ?? []).map((l: any) => l.post_id));
    const saved = new Set((mySaves ?? []).map((s: any) => s.post_id));
    setPosts((raw ?? []).map((p: any) => ({
      ...p, author: amap.get(p.user_id) ?? null,
      like_count: p.likes_count, comment_count: p.comments_count,
      liked_by_me: liked.has(p.id), saved_by_me: saved.has(p.id),
    })));

    const c: Record<string, number> = {};
    (raw ?? []).forEach((p: any) => (p.hashtags ?? []).forEach((t: string) => { c[t] = (c[t] ?? 0) + 1; }));
    setTags(Object.entries(c).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 12));

    const byAuthor: Record<string, number> = {};
    (raw ?? []).forEach((p: any) => { byAuthor[p.user_id] = (byAuthor[p.user_id] ?? 0) + (p.trending_score ?? 0); });
    setCreators(Object.entries(byAuthor).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, score]) => ({ ...(amap.get(id) ?? { id }), id, score })));
  }

  useEffect(() => { load(); }, []);

  return (
    <AppShell>
      <header className="glass flex items-center gap-3 rounded-2xl p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--trending)]"><Flame className="h-5 w-5 text-[color:var(--trending-foreground)]" /></span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">Trending hub</h1>
          <p className="text-sm text-muted-foreground">Hot hashtags, creators and posts right now.</p>
        </div>
      </header>

      {tags.length > 0 && (
        <div className="glass mt-4 flex flex-wrap gap-2 rounded-2xl p-4">
          {tags.map((t) => (
            <Link key={t.tag} to="/search" search={{ q: `#${t.tag}` }} className="press rounded-full border bg-card px-3 py-1.5 text-xs font-bold text-primary">#{t.tag} · {t.count}</Link>
          ))}
        </div>
      )}

      {creators.length > 0 && (
        <div className="glass mt-4 rounded-2xl p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Top creators</h2>
          <ul className="grid gap-3">
            {creators.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <Link to="/profile/$userId" params={{ userId: c.id }} className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {c.avatar_url ? <img src={c.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : (c.full_name || "S")[0]}
                </Link>
                <Link to="/profile/$userId" params={{ userId: c.id }} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">{c.full_name || "Student"}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-4">
        {!posts ? [0, 1].map((i) => <SkeletonPost key={i} />) : posts.length === 0 ? (
          <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Nothing trending yet.</p>
        ) : posts.map((p) => <PostCard key={p.id} post={p} currentUserId={uid} onChange={load} />)}
      </div>
    </AppShell>
  );
}
