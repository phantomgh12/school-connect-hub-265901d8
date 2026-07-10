import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToBucket } from "@/lib/upload";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Image as ImageIcon, Type, Loader2, Send, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/new-story")({
  head: () => ({ meta: [{ title: "New story — SchoolConnect" }] }),
  component: NewStoryPage,
});

const BG_PRESETS = [
  "linear-gradient(135deg,#6d5cf0,#22d3ee)",
  "linear-gradient(135deg,#f472b6,#f97316)",
  "linear-gradient(135deg,#22c55e,#0ea5e9)",
  "linear-gradient(135deg,#111827,#374151)",
  "linear-gradient(135deg,#facc15,#ef4444)",
];

function NewStoryPage() {
  const nav = useNavigate();
  const [userId, setUserId] = useState("");
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [bg, setBg] = useState(BG_PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? "")); }, []);

  async function submit() {
    if (!userId) return;
    setBusy(true);
    try {
      let media_url: string | null = null;
      let media_type: "photo" | "video" | "text" = "text";
      if (mode === "photo" && file) {
        media_url = await uploadToBucket("stories", file, userId);
        media_type = file.type.startsWith("video") ? "video" : "photo";
      }
      const { error } = await supabase.from("stories").insert({
        user_id: userId,
        media_url,
        media_type,
        caption: caption.trim() || null,
        background: mode === "text" ? bg : null,
      });
      if (error) throw error;
      toast.success("Story posted!");
      nav({ to: "/home" });
    } catch (e: any) {
      toast.error(e.message ?? "Could not post story");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="glass mx-auto max-w-2xl overflow-hidden rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <button onClick={() => nav({ to: "/home" })} className="rounded-full border p-2 hover:bg-muted"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-xl font-black">New story</h1>
        </div>

        <div className="mt-4 inline-flex rounded-full bg-muted p-1">
          <button onClick={() => setMode("photo")} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold ${mode === "photo" ? "gradient-brand text-primary-foreground shadow-brand" : "text-muted-foreground"}`}>
            <ImageIcon className="h-3.5 w-3.5" /> Photo/Video
          </button>
          <button onClick={() => setMode("text")} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold ${mode === "text" ? "gradient-brand text-primary-foreground shadow-brand" : "text-muted-foreground"}`}>
            <Type className="h-3.5 w-3.5" /> Text
          </button>
        </div>

        {mode === "photo" ? (
          <div className="mt-4">
            <input ref={fileRef} type="file" hidden accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="relative overflow-hidden rounded-2xl bg-black">
                {file.type.startsWith("video") ? (
                  <video src={URL.createObjectURL(file)} className="max-h-[420px] w-full object-contain" controls />
                ) : (
                  <img src={URL.createObjectURL(file)} className="max-h-[420px] w-full object-contain" alt="" />
                )}
                <button onClick={() => setFile(null)} className="absolute right-2 top-2 rounded-full bg-background/90 px-3 py-1 text-xs font-bold">Change</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="grid h-64 w-full place-items-center rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-muted">
                Tap to select a photo or video
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <div className="grid h-64 w-full place-items-center rounded-2xl p-4 text-center text-white shadow-brand" style={{ background: bg }}>
              <span className="text-2xl font-black leading-snug drop-shadow-lg break-words">{caption || "Type your story…"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {BG_PRESETS.map((b) => (
                <button key={b} onClick={() => setBg(b)} className={`h-8 w-8 rounded-full border-2 ${bg === b ? "border-[color:var(--brand)]" : "border-transparent"}`} style={{ background: b }} />
              ))}
            </div>
          </div>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={mode === "text" ? "What's on your mind?" : "Add a caption…"}
          rows={3}
          className="mt-3 w-full resize-none rounded-2xl border bg-background/60 p-3 text-sm outline-none focus:border-[color:var(--brand)]"
        />

        <button onClick={submit} disabled={busy || (mode === "photo" && !file) || (mode === "text" && !caption.trim())}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full gradient-brand px-5 py-3 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Share story
        </button>
      </div>
    </AppShell>
  );
}
