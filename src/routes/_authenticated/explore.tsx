import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Compass, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({ meta: [{ title: "Explore — SchoolConnect" }] }),
  component: ExplorePage,
});

function ExplorePage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("id,user_id,content,media_urls,post_type,created_at")
        .not("media_urls", "is", null)
        .order("created_at", { ascending: false })
        .limit(60);
      setPosts((data ?? []).filter((p: any) => (p.media_urls ?? []).length));
      setLoading(false);
    })();
  }, []);

  return (
    <AppShell>
      <div className="glass mb-4 flex items-center gap-3 rounded-3xl p-5">
        <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand shadow-brand">
          <Compass className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-black">Explore</h1>
          <p className="text-sm text-muted-foreground">Photos and videos from students everywhere.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-[color:var(--brand)]" />
          <p className="mt-2 text-sm text-muted-foreground">No media posts yet. Share something!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {posts.flatMap((p) =>
            (p.media_urls ?? []).slice(0, 1).map((url: string) => (
              <Link key={p.id} to="/home" hash={`post-${p.id}`} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
                {url.match(/\.(mp4|webm|mov)/i) ? (
                  <video src={url} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={url} className="h-full w-full object-cover transition group-hover:scale-105" alt="" loading="lazy" />
                )}
              </Link>
            ))
          )}
        </div>
      )}
    </AppShell>
  );
}
