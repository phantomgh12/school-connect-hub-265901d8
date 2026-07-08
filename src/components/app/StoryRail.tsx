import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer, type StoryItem } from "./StoryViewer";

type Group = { user_id: string; author: { full_name: string | null; avatar_url: string | null } | null; items: StoryItem[] };

export function StoryRail({ userId, avatarUrl }: { userId: string; avatarUrl: string | null }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [openComposer, setOpenComposer] = useState(false);
  const [viewerStart, setViewerStart] = useState<{ groupIdx: number } | null>(null);

  async function load() {
    const { data: rows } = await supabase
      .from("stories")
      .select("id,user_id,media_url,media_type,caption,background,created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: authors } = ids.length
      ? await supabase.from("profiles").select("id,full_name,avatar_url").in("id", ids)
      : { data: [] as any[] };
    const authorMap = new Map((authors ?? []).map((a: any) => [a.id, a]));
    const byUser = new Map<string, Group>();
    (rows ?? []).forEach((r: any) => {
      const author = authorMap.get(r.user_id) ?? null;
      const item: StoryItem = { ...r, author };
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, { user_id: r.user_id, author, items: [] });
      byUser.get(r.user_id)!.items.push(item);
    });
    // put current user first if present
    const arr = [...byUser.values()];
    arr.sort((a, b) => (a.user_id === userId ? -1 : b.user_id === userId ? 1 : 0));
    setGroups(arr);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const flatList: StoryItem[] = viewerStart ? groups[viewerStart.groupIdx]?.items ?? [] : [];

  return (
    <div className="glass mb-4 overflow-hidden rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Stories</h2>
        <span className="text-xs text-muted-foreground">Auto-disappears in 24h</span>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        <button onClick={() => setOpenComposer(true)} className="flex w-16 shrink-0 flex-col items-center gap-1">
          <div className="relative grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-[color:var(--brand)] bg-background text-[color:var(--brand)]">
            {avatarUrl ? <img src={avatarUrl} className="h-full w-full rounded-full object-cover" alt="" /> : <Plus className="h-5 w-5" />}
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full gradient-brand text-primary-foreground"><Plus className="h-3 w-3" /></span>
          </div>
          <span className="w-full truncate text-center text-[10px] font-semibold text-muted-foreground">Your story</span>
        </button>
        {groups.filter(g => g.user_id !== userId || g.items.length > 0).map((g, idx) => {
          if (g.user_id === userId) return null;
          const name = g.author?.full_name || "Story";
          return (
            <button key={g.user_id} onClick={() => setViewerStart({ groupIdx: idx })} className="flex w-16 shrink-0 flex-col items-center gap-1">
              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full p-0.5" style={{ background: "conic-gradient(from 180deg,#f472b6,#6d5cf0,#22d3ee,#22c55e,#f472b6)" }}>
                <div className="grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-background gradient-brand text-xs font-bold text-primary-foreground">
                  {g.author?.avatar_url ? <img src={g.author.avatar_url} className="h-full w-full object-cover" alt="" /> : name[0]}
                </div>
              </div>
              <span className="w-full truncate text-center text-[10px] font-semibold">{name}</span>
            </button>
          );
        })}
        {groups.length === 0 && (
          <div className="text-xs text-muted-foreground">No stories yet — be the first ✨</div>
        )}
      </div>

      {openComposer && <StoryComposer userId={userId} onClose={() => setOpenComposer(false)} onCreated={load} />}
      {viewerStart && flatList.length > 0 && (
        <StoryViewer stories={flatList} startIndex={0} currentUserId={userId} onClose={() => setViewerStart(null)} />
      )}
    </div>
  );
}
