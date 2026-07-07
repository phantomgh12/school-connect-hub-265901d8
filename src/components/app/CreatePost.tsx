import { useState, useRef } from "react";
import { Image as ImageIcon, Video, Loader2, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToBucket, extractHashtags } from "@/lib/upload";
import { toast } from "sonner";

export function CreatePost({ userId, avatarUrl, onPosted }: { userId: string; avatarUrl?: string | null; onPosted: () => void }) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(fl: FileList | null) {
    if (!fl) return;
    setFiles((prev) => [...prev, ...Array.from(fl)].slice(0, 4));
  }

  async function submit() {
    if (!content.trim() && files.length === 0) return;
    setBusy(true);
    try {
      const media_urls: string[] = [];
      for (const f of files) media_urls.push(await uploadToBucket("post-media", f, userId));
      const post_type = files.some((f) => f.type.startsWith("video")) ? "video" : files.length ? "photo" : "text";
      const { error } = await supabase.from("posts").insert({
        user_id: userId,
        content: content.trim() || null,
        media_urls,
        post_type,
        hashtags: extractHashtags(content),
      });
      if (error) throw error;
      setContent(""); setFiles([]);
      toast.success("Posted!");
      onPosted();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex gap-3">
        <Avatar url={avatarUrl} />
        <div className="min-w-0 flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share something with your school…"
            rows={2}
            className="w-full resize-none rounded-2xl border border-border/70 bg-background/60 p-3 text-sm outline-none focus:border-[color:var(--brand)]"
          />
          {files.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {files.map((f, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl border bg-muted">
                  {f.type.startsWith("video") ? (
                    <video src={URL.createObjectURL(f)} className="h-24 w-full object-cover" />
                  ) : (
                    <img src={URL.createObjectURL(f)} className="h-24 w-full object-cover" alt="" />
                  )}
                  <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-background/90 p-1">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <input ref={fileRef} type="file" hidden accept="image/*,video/*" multiple onChange={(e) => addFiles(e.target.files)} />
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">
                <ImageIcon className="h-4 w-4" /> Photo
              </button>
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">
                <Video className="h-4 w-4" /> Video
              </button>
            </div>
            <button
              onClick={submit}
              disabled={busy || (!content.trim() && !files.length)}
              className="inline-flex items-center gap-1.5 rounded-full gradient-brand px-5 py-2 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ url }: { url?: string | null }) {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-sm font-bold text-primary-foreground">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : "🎓"}
    </div>
  );
}
