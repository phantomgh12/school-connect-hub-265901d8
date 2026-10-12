import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryViewer, type StoryItem } from "./StoryViewer";


type Group = { user_id: string; author: { full_name: string | null; avatar_url: string | null } | null; items: StoryItem[]; unseen: number };

export function StoryRail({ userId, avatarUrl: _avatarUrl }: { userId: string; avatarUrl: string | null }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [viewerUser, setViewerUser] = useState<string | null>(null);


  async function load() {
    // RLS restricts to friends+self already, but be defensive
    const { data: rows } = await supabase
      .from("stories")
      .select("id,user_id,media_url,media_type,caption,background,created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const [{ data: authors }, { data: mySeen }] = await Promise.all([
      ids.length ? supabase.from("profiles").select("id,full_name,avatar_url").in("id", ids) : Promise.resolve({ data: [] as any[] }),
      supabase.from("story_views").select("story_id").eq("user_id", userId),
    ]);
    const seen = new Set((mySeen ?? []).map((s: any) => s.story_id));
    const authorMap = new Map((authors ?? []).map((a: any) => [a.id, a]));
    const byUser = new Map<string, Group>();
    (rows ?? []).forEach((r: any) => {
      const author = authorMap.get(r.user_id) ?? null;
      const item: StoryItem = { ...r, author };
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, { user_id: r.user_id, author, items: [], unseen: 0 });
      const group = byUser.get(r.user_id);
      if (!group) return;
      group.items.push(item);
      if (!seen.has(r.id) && r.user_id !== userId) group.unseen += 1;
    });
    const arr = [...byUser.values()].sort((a, b) => {
      if (a.user_id === userId) return -1;
      if (b.user_id === userId) return 1;
      return b.unseen - a.unseen;
    });
    setGroups(arr);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel(`stories-rail-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const activeItems: StoryItem[] = viewerUser ? groups.find((g) => g.user_id === viewerUser)?.items ?? [] : [];
  const mine = groups.find((g) => g.user_id === userId);

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-foreground">Stories</h2>
        <span className="text-[11px] text-muted-foreground">Friends only • 24h</span>
      </div>
      <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar">
        {/* Your story tile */}
        {mine ? (
          <div className="relative h-36 w-24 shrink-0">
            <Button variant="ghost" onClick={() => setViewerUser(userId)} className="relative h-full w-full overflow-hidden rounded-lg border p-0 border-border/60 bg-media text-left">
              {mine.items[mine.items.length - 1]?.media_url ? (
                <img src={mine.items.at(-1)?.media_url ?? undefined} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <div className="grid h-full w-full place-items-center p-2 text-center" style={{ background: mine.items[mine.items.length - 1]?.background ?? "var(--primary)" }}>
                  <span className="text-xs font-black text-media-foreground drop-shadow">{mine.items[mine.items.length - 1]?.caption}</span>
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-media/55 p-1.5 text-[10px] font-bold text-media-foreground">Your story</span>
            </Button>
            <Link to="/new-story" aria-label="Add to your story" className="absolute right-1 top-1 grid h-11 w-11 ring-2 ring-background place-items-center rounded-full gradient-brand text-primary-foreground shadow-brand">
              <Plus className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <Link to="/new-story" className="relative flex h-36 w-24 shrink-0 flex-col items-stretch overflow-hidden rounded-lg border-2 border-dashed border-primary/30 bg-muted/40 text-left">
            <div className="flex-1 gradient-brand opacity-80" />
            <div className="absolute inset-0 grid place-items-center">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-surface text-primary shadow-lg"><Plus className="h-5 w-5" /></div>
            </div>
            <div className="absolute bottom-1.5 left-0 right-0 truncate px-2 text-center text-[11px] font-bold text-media-foreground drop-shadow">Your story</div>
          </Link>
        )}

        {groups.filter(g => g.user_id !== userId).map((g) => {
          const cover = g.items[g.items.length - 1];
          const name = g.author?.full_name || "Story";
          const hasUnseen = g.unseen > 0;
          return (
            <Button variant="ghost" key={g.user_id} onClick={() => setViewerUser(g.user_id)} className={`relative flex h-36 w-24 shrink-0 overflow-hidden rounded-lg border ${hasUnseen ? "border-primary p-[2px]" : "border-border/60 p-0"}`}
              
            >
              <div className="relative h-full w-full overflow-hidden rounded-md bg-media">
                {cover?.media_type === "video" && cover.media_url ? (
                  <video src={cover.media_url} muted className="h-full w-full object-cover" />
                ) : cover?.media_url ? (
                  <img src={cover.media_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="grid h-full w-full place-items-center p-2 text-center" style={{ background: cover?.background ?? "var(--primary)" }}>
                    <span className="text-xs font-black text-media-foreground drop-shadow">{cover?.caption ?? name}</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-media/55 p-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-media-foreground bg-muted text-[10px] font-bold">
                      {g.author?.avatar_url ? <img src={g.author.avatar_url} className="h-full w-full object-cover" alt="" loading="lazy" decoding="async" /> : name[0]}
                    </div>
                    <span className="truncate text-[10px] font-bold text-media-foreground">{name}</span>
                  </div>
                </div>
                {hasUnseen && <span className="absolute right-1.5 top-1.5 rounded-full bg-primary px-1.5 text-[9px] font-bold text-media-foreground">{g.unseen}</span>}
              </div>
            </Button>
          );
        })}
        {groups.filter(g => g.user_id !== userId).length === 0 && (
          <div className="grid h-36 min-w-[150px] flex-1 place-items-center rounded-lg border border-dashed border-border/60 px-4 text-center text-xs text-muted-foreground">
            <div><Eye className="mx-auto mb-1 h-4 w-4" />Add friends to see their stories</div>
          </div>
        )}
      </div>

      {viewerUser && activeItems.length > 0 && (
        <StoryViewer stories={activeItems} startIndex={0} currentUserId={userId} onClose={() => { setViewerUser(null); load(); }} />
      )}


    </div>
  );
}
