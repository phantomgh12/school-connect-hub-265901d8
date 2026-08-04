import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Play, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/for-you")({
  head: () => ({ meta: [{ title: "For You — SchoolConnect" }] }),
  component: ForYouPage,
});

type Reel = {
  id: string; user_id: string; content: string | null; media_urls: string[]; created_at: string; hashtags: string[];
  author?: { full_name: string | null; avatar_url: string | null; username: string | null } | null;
  like_count: number; comment_count: number; liked: boolean;
};

function ForYouPage() {
  const [uid, setUid] = useState("");
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(id: string) {
    // Video posts only
    const { data: raw } = await supabase.from("posts")
      .select("id,user_id,content,media_urls,hashtags,created_at")
      .eq("post_type", "video")
      .order("created_at", { ascending: false })
      .limit(50);
    const authorIds = [...new Set((raw ?? []).map((p: any) => p.user_id))];
    const ids = (raw ?? []).map((p: any) => p.id);
    const safe = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];
    const [{ data: authors }, { data: likes }, { data: comments }, { data: myLikes }] = await Promise.all([
      authorIds.length ? supabase.from("profiles").select("id,full_name,avatar_url,username").in("id", authorIds) : Promise.resolve({ data: [] as any[] }),
      supabase.from("post_likes").select("post_id").in("post_id", safe),
      supabase.from("post_comments").select("post_id").in("post_id", safe),
      supabase.from("post_likes").select("post_id").eq("user_id", id),
    ]);
    const amap = new Map((authors ?? []).map((a: any) => [a.id, a]));
    const lc: Record<string, number> = {}; likes?.forEach((l: any) => lc[l.post_id] = (lc[l.post_id] ?? 0) + 1);
    const cc: Record<string, number> = {}; comments?.forEach((c: any) => cc[c.post_id] = (cc[c.post_id] ?? 0) + 1);
    const mine = new Set(myLikes?.map((l: any) => l.post_id));
    setReels((raw ?? []).map((p: any) => ({
      ...p, author: amap.get(p.user_id) ?? null, like_count: lc[p.id] ?? 0, comment_count: cc[p.id] ?? 0, liked: mine.has(p.id),
    })));
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      load(data.user.id);
    });
  }, []);

  return (
    <AppShell>
      <div className="glass mb-4 flex items-center gap-3 rounded-3xl p-5">
        <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand shadow-brand"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
        <div>
          <h1 className="text-xl font-black">For You</h1>
          <p className="text-sm text-muted-foreground">Video reels from students you might like</p>
        </div>
      </div>

      {loading ? (
        <div className="glass grid h-64 place-items-center rounded-3xl"><Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand)]" /></div>
      ) : reels.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">
          No video reels yet. <Link to="/new-post" className="font-bold text-[color:var(--brand)]">Post the first one</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {reels.map((r) => <ReelCard key={r.id} reel={r} uid={uid} onChange={() => load(uid)} />)}
        </div>
      )}
    </AppShell>
  );
}

function ReelCard({ reel, uid, onChange }: { reel: Reel; uid: string; onChange: () => void }) {
  const [liked, setLiked] = useState(reel.liked);
  const [count, setCount] = useState(reel.like_count);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const vRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = vRef.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.play().then(() => setPlaying(true)).catch(() => {}); supabase.from("post_views").upsert({ post_id: reel.id, user_id: uid }, { onConflict: "post_id,user_id" }).then(() => {}); }
      else { el.pause(); setPlaying(false); }
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [reel.id, uid]);

  async function toggleLike() {
    setLiked((v) => !v);
    setCount((n) => n + (liked ? -1 : 1));
    if (liked) await supabase.from("post_likes").delete().eq("post_id", reel.id).eq("user_id", uid);
    else await supabase.from("post_likes").insert({ post_id: reel.id, user_id: uid });
  }

  async function share() {
    const url = `${window.location.origin}/home#post-${reel.id}`;
    await supabase.from("post_shares").insert({ post_id: reel.id, user_id: uid });
    try {
      if (navigator.share) await navigator.share({ title: "SchoolConnect Reel", url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch {}
    onChange();
  }

  const videoUrl = reel.media_urls[0];
  const name = reel.author?.full_name || "Student";

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-3xl bg-black">
      <video ref={vRef} src={videoUrl} loop muted={muted} playsInline className="h-full w-full object-cover" onClick={() => { const el = vRef.current!; if (el.paused) { el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); } }} />
      {!playing && <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="grid h-14 w-14 place-items-center rounded-full bg-black/50 text-white"><Play className="h-6 w-6" /></div></div>}

      <button onClick={() => setMuted((v) => !v)} className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white">
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
        <Link to="/profile/$userId" params={{ userId: reel.user_id }} className="mb-2 inline-flex items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-white bg-muted text-xs font-bold">
            {reel.author?.avatar_url ? <img src={reel.author.avatar_url} className="h-full w-full object-cover" alt="" loading="lazy" decoding="async" /> : name[0]}
          </div>
          <span className="text-sm font-bold drop-shadow">{name}</span>
        </Link>
        {reel.content && <p className="line-clamp-2 text-sm drop-shadow">{reel.content}</p>}
      </div>

      <div className="absolute bottom-24 right-3 grid gap-3">
        <button onClick={toggleLike} className="grid place-items-center text-white">
          <div className={`grid h-11 w-11 place-items-center rounded-full ${liked ? "bg-rose-500" : "bg-black/50"} backdrop-blur`}><Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} /></div>
          <span className="mt-0.5 text-[11px] font-bold drop-shadow">{count}</span>
        </button>
        <div className="grid place-items-center text-white">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-black/50 backdrop-blur"><MessageCircle className="h-5 w-5" /></div>
          <span className="mt-0.5 text-[11px] font-bold drop-shadow">{reel.comment_count}</span>
        </div>
        <button onClick={share} className="grid place-items-center text-white">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-black/50 backdrop-blur"><Share2 className="h-5 w-5" /></div>
          <span className="mt-0.5 text-[11px] font-bold drop-shadow">Share</span>
        </button>
      </div>
    </div>
  );
}
