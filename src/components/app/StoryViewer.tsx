import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Heart, ChevronLeft, ChevronRight } from "lucide-react";
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

export function StoryViewer({ stories, startIndex, currentUserId, onClose }: { stories: StoryItem[]; startIndex: number; currentUserId: string; onClose: () => void }) {
  const [i, setI] = useState(startIndex);
  const [reply, setReply] = useState("");
  const [progress, setProgress] = useState(0);
  const story = stories[i];

  useEffect(() => {
    if (!story) return;
    setProgress(0);
    // record view
    supabase.from("story_views").upsert({ story_id: story.id, user_id: currentUserId }).then(() => {});
    const start = Date.now();
    const dur = 5000;
    const iv = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / dur);
      setProgress(p);
      if (p >= 1) {
        clearInterval(iv);
        if (i < stories.length - 1) setI(i + 1);
        else onClose();
      }
    }, 50);
    return () => clearInterval(iv);
  }, [i, story, stories.length, currentUserId, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setI((n) => Math.min(stories.length - 1, n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stories.length, onClose]);


  if (!story) return null;
  const name = story.author?.full_name || "Student";

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/95 backdrop-blur sm:p-4">
      <div className="relative flex h-[100dvh] w-full flex-col sm:h-auto sm:max-h-[95vh] sm:w-auto sm:max-w-[420px]">
        {/* Progress bars */}
        <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 p-2">
          {stories.map((_, idx) => (
            <div key={idx} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full bg-white transition-all" style={{ width: idx < i ? "100%" : idx === i ? `${progress * 100}%` : "0%" }} />
            </div>
          ))}
        </div>

        <div className="absolute left-3 right-3 top-6 z-20 flex items-center gap-2">
          <Link to="/profile/$userId" params={{ userId: story.user_id }} onClick={onClose} className="flex min-w-0 items-center gap-2 hover:opacity-80">
            <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-xs font-bold text-white">
              {story.author?.avatar_url ? <img src={story.author.avatar_url} className="h-full w-full object-cover" alt="" /> : name[0]}
            </div>
            <div className="truncate text-sm font-semibold text-white drop-shadow">{name}</div>
          </Link>
          <button onClick={onClose} className="ml-auto rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30"><X className="h-4 w-4" /></button>
        </div>


        <div className="relative flex-1 overflow-hidden bg-black sm:flex-none sm:rounded-3xl">
          {story.media_type === "video" && story.media_url ? (
            <video src={story.media_url} autoPlay muted playsInline className="h-full max-h-[100dvh] w-full object-contain sm:max-h-[85vh]" />
          ) : story.media_type === "photo" && story.media_url ? (
            <img src={story.media_url} className="h-full max-h-[100dvh] w-full object-contain sm:max-h-[85vh]" alt="" />
          ) : (
            <div className="grid h-full min-h-[70vh] w-full place-items-center p-6 text-center" style={{ background: story.background ?? "linear-gradient(135deg,#6d5cf0,#22d3ee)" }}>
              <span className="text-3xl font-black text-white drop-shadow-lg">{story.caption}</span>
            </div>
          )}

          {story.caption && story.media_type !== "text" && (
            <div className="absolute bottom-20 left-4 right-4 rounded-2xl bg-black/50 p-3 text-sm font-semibold text-white backdrop-blur">{story.caption}</div>
          )}

          {/* Tap zones */}
          <button className="absolute left-0 top-0 h-full w-1/3" onClick={() => setI(Math.max(0, i - 1))} aria-label="Previous" />
          <button className="absolute right-0 top-0 h-full w-1/3" onClick={() => (i < stories.length - 1 ? setI(i + 1) : onClose())} aria-label="Next" />
          {i > 0 && <button onClick={() => setI(i - 1)} className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/20 p-2 text-white sm:block"><ChevronLeft className="h-5 w-5" /></button>}
          {i < stories.length - 1 && <button onClick={() => setI(i + 1)} className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/20 p-2 text-white sm:block"><ChevronRight className="h-5 w-5" /></button>}
        </div>

        {story.user_id !== currentUserId && (
          <div className="absolute bottom-3 left-3 right-3 z-10 grid gap-2">
            <div className="flex justify-center gap-1">
              {REACTIONS.map((e) => (
                <button key={e} onClick={() => react(e)} className="rounded-full bg-black/40 px-2 py-1 text-lg hover:scale-110 transition">{e}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
                placeholder={`Reply to ${name}…`}
                className="flex-1 rounded-full border border-white/30 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-white/60 outline-none"
              />
              <button onClick={sendReply} className="rounded-full bg-white p-2 text-black"><Send className="h-4 w-4" /></button>
              <button onClick={() => react("❤️")} className="rounded-full bg-white p-2 text-rose-500"><Heart className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
