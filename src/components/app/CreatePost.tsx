import { useState, useRef } from "react";
import { Image as ImageIcon, Video, Loader2, X, Send, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToBucket, extractHashtags } from "@/lib/upload";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

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
    <div className="glass mt-5 rounded-lg p-4 sm:p-5">
      <div className="flex gap-3">
        <Avatar url={avatarUrl} />
        <div className="min-w-0 flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What’s happening in your world?"
            rows={2}
            className="w-full resize-none rounded-md border-0 bg-transparent p-1 text-base outline-none placeholder:text-muted-foreground"
          />
          {files.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {files.map((f, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl border bg-muted">
                  {f.type.startsWith("video") ? (
                    <video src={URL.createObjectURL(f)} className="h-22 w-full object-cover" />
                  ) : (
                    <img src={URL.createObjectURL(f)} className="h-22 w-full object-cover" alt="" loading="lazy" decoding="async" />
                  )}
                  <Button variant="secondary" size="icon" aria-label="Remove attachment" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="absolute right-1 top-1 size-8 bg-background/90">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t pt-3">
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="icon" title="More post options"><Link to="/new-post" aria-label="More post options"><MoreHorizontal className="size-5" /></Link></Button>
              <input ref={fileRef} type="file" hidden accept="image/*,video/*" multiple onChange={(e) => addFiles(e.target.files)} />
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5 px-2 text-muted-foreground">
                <ImageIcon className="h-5 w-5" /> Photo
              </Button>
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5 px-2 text-muted-foreground">
                <Video className="h-5 w-5" /> Video
              </Button>
            </div>
            <Button
              onClick={submit}
              disabled={busy || (!content.trim() && !files.length)}
              className="gap-2 px-4"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ url }: { url?: string | null }) {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-sm font-bold text-primary-foreground">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : "🎓"}
    </div>
  );
}
