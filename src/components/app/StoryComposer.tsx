import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToBucket } from "@/lib/upload";
import { toast } from "sonner";
import { Image as ImageIcon, Type, X, Loader2, Send } from "lucide-react";

const BG_PRESETS = [
  "linear-gradient(135deg,#6d5cf0,#22d3ee)",
  "linear-gradient(135deg,#f472b6,#f97316)",
  "linear-gradient(135deg,#22c55e,#0ea5e9)",
  "linear-gradient(135deg,#111827,#374151)",
  "linear-gradient(135deg,#facc15,#ef4444)",
];

export function StoryComposer({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [bg, setBg] = useState(BG_PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
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
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Could not post story");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur">
      <div className="glass w-full max-w-md rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">New story</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
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
                  <video src={URL.createObjectURL(file)} className="max-h-72 w-full object-contain" controls />
                ) : (
                  <img src={URL.createObjectURL(file)} className="max-h-72 w-full object-contain" alt="" />
                )}
                <button onClick={() => setFile(null)} className="absolute right-2 top-2 rounded-full bg-background/90 p-1"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="grid h-56 w-full place-items-center rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-muted">
                Tap to select a photo or video
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <div className="grid h-56 w-full place-items-center rounded-2xl p-4 text-center text-white shadow-brand" style={{ background: bg }}>
              <span className="text-xl font-black leading-snug drop-shadow-lg">{caption || "Type your story…"}</span>
            </div>
            <div className="mt-3 flex gap-2">
              {BG_PRESETS.map((b) => (
                <button key={b} onClick={() => setBg(b)} className={`h-7 w-7 rounded-full border-2 ${bg === b ? "border-[color:var(--brand)]" : "border-transparent"}`} style={{ background: b }} />
              ))}
            </div>
          </div>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={mode === "text" ? "What's on your mind?" : "Add a caption…"}
          rows={2}
          className="mt-3 w-full resize-none rounded-2xl border bg-background/60 p-3 text-sm outline-none focus:border-[color:var(--brand)]"
        />

        <button onClick={submit} disabled={busy || (mode === "photo" && !file) || (mode === "text" && !caption.trim())}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full gradient-brand px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Share story
        </button>
      </div>
    </div>
  );
}
