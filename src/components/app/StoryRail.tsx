import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Eye } from "lucide-react";
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
      byUser.get(r.user_id)!.items.push(item);
      if (!seen.has(r.id) && r.user_id !== userId) byUser.get(r.user_id)!.unseen += 1;
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

  const activeItems: StoryItem[] = viewerIdx != null ? groups[viewerIdx]?.items ?? [] : [];

  return (
    <div className="glass mb-4 rounded-3xl p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Stories</h2>
        <span className="text-[11px] text-muted-foreground">Friends only • 24h</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {/* Your story tile */}
        <Link to="/new-story" className="relative flex h-40 w-24 shrink-0 flex-col items-stretch overflow-hidden rounded-2xl border-2 border-dashed border-[color:var(--brand)]/50 bg-muted/40 text-left">
          <div className="flex-1 gradient-brand opacity-80" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white text-[color:var(--brand)] shadow-lg"><Plus className="h-5 w-5" /></div>
          </div>
          <div className="absolute bottom-1.5 left-0 right-0 truncate px-2 text-center text-[11px] font-bold text-white drop-shadow">Your story</div>
        </Link>

        {groups.filter(g => g.user_id !== userId).map((g, idx) => {
          const cover = g.items[g.items.length - 1];
          const name = g.author?.full_name || "Story";
          const hasUnseen = g.unseen > 0;
          return (
            <button key={g.user_id} onClick={() => setViewerIdx(idx)} className={`relative flex h-40 w-24 shrink-0 overflow-hidden rounded-2xl border ${hasUnseen ? "border-transparent p-[2px]" : "border-border/60"}`}
              style={hasUnseen ? { background: "conic-gradient(from 180deg,#f472b6,#6d5cf0,#22d3ee,#22c55e,#f472b6)" } : {}}
            >
              <div className="relative h-full w-full overflow-hidden rounded-[14px] bg-black">
                {cover?.media_type === "video" && cover.media_url ? (
                  <video src={cover.media_url} muted className="h-full w-full object-cover" />
                ) : cover?.media_url ? (
                  <img src={cover.media_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center p-2 text-center" style={{ background: cover?.background ?? "linear-gradient(135deg,#6d5cf0,#22d3ee)" }}>
                    <span className="text-xs font-black text-white drop-shadow">{cover?.caption ?? name}</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-muted text-[10px] font-bold">
                      {g.author?.avatar_url ? <img src={g.author.avatar_url} className="h-full w-full object-cover" alt="" /> : name[0]}
                    </div>
                    <span className="truncate text-[10px] font-bold text-white">{name}</span>
                  </div>
                </div>
                {hasUnseen && <span className="absolute right-1.5 top-1.5 rounded-full bg-rose-500 px-1.5 text-[9px] font-bold text-white">{g.unseen}</span>}
              </div>
            </button>
          );
        })}
        {groups.length <= 1 && (
          <div className="grid h-40 flex-1 place-items-center rounded-2xl border border-dashed border-border/60 px-4 text-center text-xs text-muted-foreground">
            <div><Eye className="mx-auto mb-1 h-4 w-4" />Add friends to see their stories</div>
          </div>
        )}
      </div>

      {viewerIdx != null && activeItems.length > 0 && (
        <StoryViewer stories={activeItems} startIndex={0} currentUserId={userId} onClose={() => { setViewerIdx(null); load(); }} />
      )}

    </div>
  );
}
