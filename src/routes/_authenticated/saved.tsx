import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { PostCard, type FeedPost } from "@/components/app/PostCard";
import { Bookmark } from "lucide-react";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Saved — SchoolConnect" }] }),
  component: SavedPage,
});

function SavedPage() {
  const [uid, setUid] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const id = u.user?.id;
    if (!id) return;
    setUid(id);
    const { data: saves } = await supabase.from("post_saves").select("post_id").eq("user_id", id);
    const postIds = (saves ?? []).map((s: any) => s.post_id);
    if (postIds.length === 0) { setPosts([]); setLoading(false); return; }
    const { data: rawPosts } = await supabase.from("posts").select("*").in("id", postIds).order("created_at", { ascending: false });
    const authorIds = [...new Set((rawPosts ?? []).map((p: any) => p.user_id))];
    const { data: authors } = authorIds.length ? await supabase.from("profiles").select("id,full_name,username,avatar_url,school_name").in("id", authorIds) : { data: [] };
    const amap = new Map((authors ?? []).map((a: any) => [a.id, a]));
    setPosts((rawPosts ?? []).map((p: any) => ({
      ...p, author: amap.get(p.user_id) ?? null,
      like_count: 0, comment_count: 0, liked_by_me: false, saved_by_me: true,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell>
      <div className="glass mb-4 flex items-center gap-3 rounded-3xl p-5">
        <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand shadow-brand">
          <Bookmark className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-black">Saved</h1>
          <p className="text-sm text-muted-foreground">Posts you bookmarked</p>
        </div>
      </div>
      {loading ? (
        <div className="glass grid h-40 place-items-center rounded-3xl text-sm text-muted-foreground">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">You haven't saved anything yet.</div>
      ) : (
        <div className="grid gap-4">
          {posts.map((p) => <PostCard key={p.id} post={p} currentUserId={uid} onChange={load} />)}
        </div>
      )}
    </AppShell>
  );
}
