import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Heart, ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { notify } from "@/lib/notify";

export type StoryItem = {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: string;
  caption: string | null;
  background: string | null;
  created_at: string;
  author?: { full_name: string | null; avatar_url: string | null } | null;
};

const REACTIONS = ["❤️", "🔥", "😂", "😮", "👏", "😢"];

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export function StoryViewer({ stories, startIndex, currentUserId, onClose }: { stories: StoryItem[]; startIndex: number; currentUserId: string; onClose: () => void }) {
  const [i, setI] = useState(startIndex);
  const [reply, setReply] = useState("");
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const story = stories[i];

  useEffect(() => {
    if (!story) return;
    setProgress(0);
    supabase.from("story_views").upsert({ story_id: story.id, user_id: currentUserId }).then(() => {});
  }, [i, story?.id, currentUserId]);

  useEffect(() => {
    if (!story || paused) return;
    let elapsed = 0;
    const step = 50;
    const dur = 5000;
    const iv = setInterval(() => {
      elapsed += step;
      const p = Math.min(1, elapsed / dur);
      setProgress(p);
      if (p >= 1) {
        clearInterval(iv);
        if (i < stories.length - 1) setI(i + 1);
        else onClose();
      }
    }, step);
    return () => clearInterval(iv);
  }, [i, paused, story, stories.length, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setI((n) => Math.min(stories.length - 1, n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stories.length, onClose]);

  if (!story) return null;
  const name = story.author?.full_name || "Student";
  const isMine = story.user_id === currentUserId;

  async function react(emoji: string) {
    await supabase.from("story_reactions").insert({ story_id: story.id, user_id: currentUserId, emoji });
    await notify({ userId: story.user_id, actorId: currentUserId, type: "story_reaction", message: `${emoji} reacted to your story` });
    toast.success(`${emoji} sent`);
  }

  async function sendReply() {
    if (!reply.trim()) return;
    await supabase.from("story_replies").insert({ story_id: story.id, user_id: currentUserId, content: reply.trim() });
    await notify({ userId: story.user_id, actorId: currentUserId, type: "story_reply", message: `Replied to your story: ${reply.slice(0, 60)}` });
    setReply("");
    toast.success("Reply sent");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm sm:p-6">
      {/* Desktop side arrows, outside the media frame so nothing overlaps */}
      {i > 0 && (
        <button onClick={() => setI(i - 1)} aria-label="Previous story" className="absolute left-4 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/25 lg:block">
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {i < stories.length - 1 && (
        <button onClick={() => setI(i + 1)} aria-label="Next story" className="absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/25 lg:block">
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-black sm:h-[min(90dvh,760px)] sm:w-[min(100%,420px)] sm:rounded-3xl sm:shadow-2xl">
        {/* Header — its own row, never over the media */}
        <div className="shrink-0 bg-black/55 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex gap-1">
            {stories.map((_, idx) => (
              <div key={idx} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
                <div className="h-full bg-white" style={{ width: idx < i ? "100%" : idx === i ? `${progress * 100}%` : "0%" }} />
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <Link to="/profile/$userId" params={{ userId: story.user_id }} onClick={onClose} className="flex min-w-0 items-center gap-2 hover:opacity-80">
              <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-xs font-bold text-white">
                {story.author?.avatar_url ? <img src={story.author.avatar_url} className="h-full w-full object-cover" alt="" loading="lazy" decoding="async" /> : name[0]}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white">{name}</div>
                <div className="text-[11px] text-white/70">{timeAgo(story.created_at)} ago</div>
              </div>
            </Link>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <button onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"} className="rounded-full bg-white/15 p-2 text-white hover:bg-white/25">
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
              <button onClick={onClose} aria-label="Close" className="rounded-full bg-white/15 p-2 text-white hover:bg-white/25">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Media — flexes to fill remaining space */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {story.media_type === "video" && story.media_url ? (
            <video key={story.id} src={story.media_url} autoPlay muted playsInline className="h-full w-full object-contain" />
          ) : story.media_type === "photo" && story.media_url ? (
            <img src={story.media_url} className="h-full w-full object-contain" alt={story.caption ?? "Story"} loading="lazy" decoding="async" />
          ) : (
            <div className="grid h-full w-full place-items-center p-6 text-center" style={{ background: story.background ?? "linear-gradient(135deg,#6d5cf0,#22d3ee)" }}>
              <span className="max-w-full break-words text-2xl font-black leading-snug text-white drop-shadow-lg sm:text-3xl">{story.caption}</span>
            </div>
          )}

          {/* Tap zones sit under the caption */}
          <button className="absolute left-0 top-0 z-0 h-full w-1/3" onClick={() => setI(Math.max(0, i - 1))} aria-label="Previous" />
          <button className="absolute right-0 top-0 z-0 h-full w-1/3" onClick={() => (i < stories.length - 1 ? setI(i + 1) : onClose())} aria-label="Next" />

          {story.caption && story.media_type !== "text" && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-2xl bg-black/55 p-3 text-sm font-medium leading-snug text-white backdrop-blur">
              <span className="line-clamp-4 break-words">{story.caption}</span>
            </div>
          )}
        </div>

        {/* Footer — its own row */}
        {!isMine ? (
          <div className="shrink-0 grid gap-2 bg-black/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <div className="flex justify-center gap-1 overflow-x-auto">
              {REACTIONS.map((e) => (
                <button key={e} onClick={() => react(e)} className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-lg transition hover:scale-110">{e}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
                placeholder={`Reply to ${name}…`}
                className="min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/60 outline-none focus:border-white/50"
              />
              <button onClick={sendReply} aria-label="Send reply" className="shrink-0 rounded-full bg-white p-2.5 text-black"><Send className="h-4 w-4" /></button>
              <button onClick={() => react("❤️")} aria-label="Like story" className="shrink-0 rounded-full bg-white p-2.5 text-rose-500"><Heart className="h-4 w-4" /></button>
            </div>
          </div>
        ) : (
          <div className="shrink-0 bg-black/70 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-center text-xs text-white/70">
            Your story • visible to friends for 24 hours
          </div>
        )}
      </div>
    </div>
  );
}
