import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { uploadToBucket, extractHashtags } from "@/lib/upload";
import { toast } from "sonner";
import { Image as ImageIcon, Video, Loader2, X, Send, Hash, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/new-post")({
  head: () => ({ meta: [{ title: "Create post — SchoolConnect" }] }),
  component: NewPostPage,
});

function NewPostPage() {
  const nav = useNavigate();
  const [uid, setUid] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      const { data: p } = await supabase.from("profiles").select("avatar_url").eq("id", data.user.id).maybeSingle();
      setAvatar(p?.avatar_url ?? null);
    });
  }, []);

  function addFiles(fl: FileList | null) {
    if (!fl) return;
    setFiles((prev) => [...prev, ...Array.from(fl)].slice(0, 6));
  }

  async function submit() {
    if (!content.trim() && !files.length) return toast.error("Add some content first");
    const tags = extractHashtags(content);
    if (tags.length < 1) return toast.error("Add at least 1 hashtag (e.g. #school)");
    if (tags.length > 5) return toast.error("Maximum 5 hashtags allowed");
    setBusy(true);
    try {
      const media_urls: string[] = [];
      for (const f of files) media_urls.push(await uploadToBucket("post-media", f, uid));
      const post_type = files.some((f) => f.type.startsWith("video")) ? "video" : files.length ? "photo" : "text";
      const { error } = await supabase.from("posts").insert({
        user_id: uid,
        content: content.trim() || null,
        media_urls,
        post_type,
        hashtags: tags,
      });
      if (error) throw error;
      toast.success("Posted! 🎉");
      nav({ to: "/home" });
    } catch (e: any) {
      toast.error(e.message ?? "Could not post");
    } finally {
      setBusy(false);
    }
  }

  const hashtags = extractHashtags(content);

  return (
    <AppShell>
      <div className="glass rounded-3xl p-5 sm:p-7">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand shadow-brand"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
          <div>
            <h1 className="text-2xl font-black">Create a post</h1>
            <p className="text-sm text-muted-foreground">Share text, photos or videos with your school community.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-sm font-bold text-primary-foreground">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : "🎓"}
          </div>
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening at school today? Use #hashtags and @mentions"
            rows={6}
            className="min-h-32 flex-1 resize-none rounded-2xl border border-border/70 bg-background/60 p-4 text-base outline-none focus:border-[color:var(--brand)]"
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {files.map((f, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl border bg-muted">
                {f.type.startsWith("video")
                  ? <video src={URL.createObjectURL(f)} className="h-40 w-full object-cover" controls />
                  : <img src={URL.createObjectURL(f)} className="h-40 w-full object-cover" alt="" />}
                <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {hashtags.map((h) => (
            <span key={h} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand)]/10 px-2.5 py-0.5 text-xs font-semibold text-[color:var(--brand)]"><Hash className="h-3 w-3" />{h}</span>
          ))}
          <span className={`ml-auto text-[11px] font-semibold ${hashtags.length < 1 || hashtags.length > 5 ? "text-rose-500" : "text-muted-foreground"}`}>
            {hashtags.length}/5 hashtags {hashtags.length < 1 ? "• add at least 1" : hashtags.length > 5 ? "• too many" : "✓"}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <input ref={fileRef} type="file" hidden accept="image/*,video/*" multiple onChange={(e) => addFiles(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted">
              <ImageIcon className="h-4 w-4" /> Photo
            </button>
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted">
              <Video className="h-4 w-4" /> Video
            </button>
          </div>
          <button
            onClick={submit}
            disabled={busy || (!content.trim() && !files.length)}
            className="inline-flex items-center gap-2 rounded-full gradient-brand px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish
          </button>
        </div>
      </div>
    </AppShell>
  );
}
