import { useEffect, useState } from "react";
import { BarChart3, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Poll = { question: string; options: string[] };

/** Live, realtime poll attached to a post. One vote per student, changeable. */
export function PostPoll({ postId, poll, currentUserId }: { postId: string; poll: Poll; currentUserId: string }) {
  const [counts, setCounts] = useState<number[]>(poll.options.map(() => 0));
  const [mine, setMine] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("post_poll_votes").select("option_index,user_id").eq("post_id", postId);
    const next = poll.options.map(() => 0);
    let own: number | null = null;
    (data ?? []).forEach((v: any) => {
      if (typeof v.option_index === "number" && next[v.option_index] !== undefined) next[v.option_index]!++;
      if (v.user_id === currentUserId) own = v.option_index;
    });
    setCounts(next);
    setMine(own);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`poll-${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_poll_votes", filter: `post_id=eq.${postId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const total = counts.reduce((a, b) => a + b, 0);

  async function vote(i: number) {
    if (busy) return;
    setBusy(true);
    const prev = mine;
    setMine(i);
    setCounts((c) => {
      const n = [...c];
      if (prev !== null && n[prev] !== undefined) n[prev]!--;
      n[i]!++;
      return n;
    });
    const { error } = await supabase
      .from("post_poll_votes")
      .upsert({ post_id: postId, user_id: currentUserId, option_index: i }, { onConflict: "post_id,user_id" });
    setBusy(false);
    if (error) {
      toast.error("Could not save your vote");
      load();
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-bold">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="min-w-0 break-words">{poll.question}</span>
      </div>
      <div className="mt-2.5 grid gap-2">
        {poll.options.map((o, i) => {
          const pct = total ? Math.round(((counts[i] ?? 0) / total) * 100) : 0;
          const picked = mine === i;
          return (
            <button
              key={i}
              onClick={() => vote(i)}
              className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                picked ? "border-primary" : "border-border hover:border-primary/60"
              }`}
            >
              <span
                className={`absolute inset-y-0 left-0 ${picked ? "bg-primary/20" : "bg-muted"}`}
                style={{ width: `${mine === null ? 0 : pct}%`, transition: "width .35s ease" }}
              />
              <span className="relative flex items-center gap-2">
                {picked && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                <span className="min-w-0 flex-1 break-words">{o}</span>
                {mine !== null && <span className="shrink-0 text-xs text-muted-foreground">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        {total} vote{total === 1 ? "" : "s"}
        {mine === null ? " • tap an option to see results" : " • tap another option to change your vote"}
      </p>
    </div>
  );
}
