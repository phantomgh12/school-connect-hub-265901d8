import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { uploadToBucket, extractHashtags } from "@/lib/upload";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AttachmentPreview } from "@/components/app/AttachmentPreview";
import { attachmentKind, safePostLink, type PostOptions } from "@/lib/post-options";
import {
  Image as ImageIcon, Video, Loader2, X, Send, Hash, Sparkles,
  Globe, Users, School, BarChart3, Smile, Clock, FileText, Plus, Music, Link as LinkIcon, ShieldAlert, Crop,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/new-post")({
  head: () => ({
    meta: [
      { title: "Create a post — SchoolConnect" },
      { name: "description", content: "Share text, photos, videos, audio, PDFs, links, polls and feelings with your school community on SchoolConnect." },
      { property: "og:title", content: "Create a post — SchoolConnect" },
      { property: "og:description", content: "Post to your school, your friends or everyone. Add polls, feelings, drafts and scheduling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewPostPage,
});

const AUDIENCES = [
  { key: "public", label: "Everyone", Icon: Globe },
  { key: "friends", label: "Friends", Icon: Users },
  { key: "school", label: "My school", Icon: School },
] as const;

const FEELINGS = ["happy 😄", "excited 🤩", "grateful 🙏", "tired 😴", "focused 📚", "stressed 😵", "proud 🏆", "bored 🥱", "in love 🥰", "motivated 🔥"];

function NewPostPage() {
  const nav = useNavigate();
  const [uid, setUid] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [accept, setAccept] = useState("image/*");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [warning, setWarning] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [aspect, setAspect] = useState<NonNullable<PostOptions["aspect"]>>("original");
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  function pickFiles(type: string) { setAccept(type); requestAnimationFrame(() => fileRef.current?.click()); }

  const [audience, setAudience] = useState<"public" | "friends" | "school">("public");
  const [feeling, setFeeling] = useState<string | null>(null);
  const [showFeelings, setShowFeelings] = useState(false);
  const [pollOn, setPollOn] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [scheduleAt, setScheduleAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      const { data: p } = await supabase.from("profiles").select("avatar_url").eq("id", data.user.id).maybeSingle();
      setAvatar(p?.avatar_url ?? null);
    });
  }, []);

  // Restore an unsent draft locally
  useEffect(() => {
    const saved = localStorage.getItem("sc:draft");
    if (saved) setContent(saved);
  }, []);
  useEffect(() => {
    if (content) localStorage.setItem("sc:draft", content);
    else localStorage.removeItem("sc:draft");
  }, [content]);

  function addFiles(fl: FileList | null) {
    if (!fl) return;
    const valid = Array.from(fl).filter((f) => (f.type.startsWith("image/") || f.type.startsWith("video/") || f.type.startsWith("audio/") || f.type === "application/pdf") && f.size <= 50 * 1024 * 1024);
    if (valid.length !== fl.length) toast.error("Use photos, videos, audio or PDFs smaller than 50 MB");
    setFiles((prev) => [...prev, ...valid].slice(0, 6));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(asDraft = false) {
    if (!uid) return toast.error("Please sign in again");
    if (link.trim() && !safePostLink(link.trim())) return toast.error("Use a full https:// or http:// link");
    if (!content.trim() && !files.length && !pollOn && !link.trim()) return toast.error("Add some content first");
    const tags = extractHashtags(content);
    if (!asDraft) {
      if (tags.length < 1) return toast.error("Add at least 1 hashtag (e.g. #school)");
      if (tags.length > 5) return toast.error("Maximum 5 hashtags allowed");
    }

    let poll: { question: string; options: string[] } | null = null;
    if (pollOn) {
      const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (!pollQuestion.trim()) return toast.error("Your poll needs a question");
      if (opts.length < 2) return toast.error("Your poll needs at least 2 options");
      poll = { question: pollQuestion.trim(), options: opts.slice(0, 6) };
    }

    let publish_at: string | null = null;
    if (scheduleAt) {
      const when = new Date(scheduleAt);
      if (isNaN(when.getTime())) return toast.error("That schedule time isn't valid");
      if (when.getTime() < Date.now()) return toast.error("Pick a time in the future");
      publish_at = when.toISOString();
    }

    setBusy(true);
    try {
      const media_urls: string[] = [];
      for (const f of files) media_urls.push(await uploadToBucket("post-media", f, uid));
      const post_type = files.some((f) => f.type.startsWith("video")) ? "video" : files.some((f) => f.type.startsWith("audio")) ? "audio" : files.some((f) => f.type.startsWith("image")) ? "photo" : files.length ? "document" : "text";
      const { error } = await supabase.from("posts").insert({
        user_id: uid,
        content: content.trim() || null,
        media_urls,
        post_type,
        hashtags: tags,
        options: { link: safePostLink(link.trim()) ?? undefined, warning: warning.trim() || undefined, aspect, attachments: files.map((f) => ({ kind: attachmentKind(f), name: f.name, description: descriptions[f.name] ?? "" })) },
        audience,
        feeling,
        poll,
        is_draft: asDraft,
        publish_at: publish_at ?? undefined,
      });
      if (error) throw error;
      localStorage.removeItem("sc:draft");
      toast.success(asDraft ? "Saved as draft" : publish_at ? "Scheduled! 🕒" : "Posted! 🎉");
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
      <div className="mx-auto w-full min-w-0 max-w-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black sm:text-2xl">Create a post</h1>

          </div>
        </div>

        {/* audience */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {AUDIENCES.map(({ key, label, Icon }) => (
            <Button
              key={key}
              onClick={() => setAudience(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${audience === key ? "border-transparent bg-primary text-primary-foreground" : "bg-background/60 hover:bg-muted"}`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </Button>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : "🎓"}
          </div>
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening at school today? Use #hashtags and @mentions"
            rows={6}
            className="min-h-32 w-full min-w-0 flex-1 resize-none rounded-2xl border border-border/70 bg-background/60 p-4 text-base outline-none focus:border-primary"
          />
        </div>

        {feeling && (
          <p className="mt-2 text-sm text-muted-foreground">
            Feeling <span className="font-semibold text-foreground">{feeling}</span>
            <Button onClick={() => setFeeling(null)} className="ml-2 text-xs underline">remove</Button>
          </p>
        )}

        {showFeelings && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FEELINGS.map((f) => (
              <Button key={f} onClick={() => { setFeeling(f); setShowFeelings(false); }} className="rounded-full border bg-background/60 px-3 py-1 text-xs font-semibold hover:bg-muted">{f}</Button>
            ))}
          </div>
        )}

        {pollOn && (
          <div className="mt-3 rounded-2xl border border-border/70 bg-background/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"><BarChart3 className="h-3.5 w-3.5" /> Poll</span>
              <Button onClick={() => setPollOn(false)} className="rounded-full p-1 hover:bg-muted"><X className="h-3.5 w-3.5" /></Button>
            </div>
            <input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ask a question…"
              className="mb-2 w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="space-y-2">
              {pollOptions.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={o}
                    onChange={(e) => setPollOptions((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder={`Option ${i + 1}`}
                    className="min-w-0 flex-1 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  {pollOptions.length > 2 && (
                    <Button onClick={() => setPollOptions((p) => p.filter((_, j) => j !== i))} className="rounded-full p-1.5 hover:bg-muted"><X className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < 6 && (
              <Button onClick={() => setPollOptions((p) => [...p, ""])} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="h-3.5 w-3.5" /> Add option</Button>
            )}
          </div>
        )}

        {showSchedule && (
          <div className="mt-3 grid min-w-0 gap-2 rounded-2xl border border-border/70 bg-background/60 p-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Publish later</span>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="rounded-xl border border-border/70 bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
            {scheduleAt && <Button onClick={() => setScheduleAt("")} className="text-xs underline">clear</Button>}
          </div>
        )}

        {showLink && <div className="mt-4"><label className="text-sm font-semibold" htmlFor="post-link">Link</label><input id="post-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className="mt-2 w-full rounded-md border bg-card px-3 py-2" /></div>}
        {showWarning && <div className="mt-4"><label className="text-sm font-semibold" htmlFor="post-warning">Content warning</label><input id="post-warning" value={warning} onChange={(e) => setWarning(e.target.value)} placeholder="Sensitive topic" maxLength={120} className="mt-2 w-full rounded-md border bg-card px-3 py-2" /></div>}
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><label htmlFor="post-aspect" className="flex min-w-0 items-center gap-2 text-sm"><Crop className="size-4 shrink-0" />Media shape</label><select id="post-aspect" value={aspect} onChange={(e) => setAspect(e.target.value as NonNullable<PostOptions["aspect"]>)} className="rounded-md border bg-card px-2 py-2 text-sm"><option value="original">Original</option><option value="square">Square 1:1</option><option value="portrait">Portrait 4:5</option><option value="wide">Wide 16:9</option></select></div>
        {files.length > 0 && <div className="mt-4 min-w-0">{files.map((f, i) => <AttachmentPreview key={`${f.name}-${i}`} file={f} aspect={aspect} description={descriptions[f.name] ?? ""} onDescription={(value) => setDescriptions((p) => ({ ...p, [f.name]: value }))} onRemove={() => setFiles((p) => p.filter((_, j) => j !== i))} />)}</div>}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {hashtags.map((h) => (
            <span key={h} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"><Hash className="h-3 w-3" />{h}</span>
          ))}
          <span className={`ml-auto text-[11px] font-semibold ${hashtags.length < 1 || hashtags.length > 5 ? "text-destructive" : "text-muted-foreground"}`}>
            {hashtags.length}/5 hashtags {hashtags.length < 1 ? "• add at least 1" : hashtags.length > 5 ? "• too many" : "✓"}
          </span>
        </div>

        <div className="mt-5 grid min-w-0 gap-4 border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <input ref={fileRef} type="file" hidden accept={accept} multiple onChange={(e) => addFiles(e.target.files)} />
            <Tool onClick={() => pickFiles("image/*")} Icon={ImageIcon} label="Photo" />
            <Tool onClick={() => pickFiles("video/*")} Icon={Video} label="Video" />
            <Tool onClick={() => pickFiles("audio/*")} Icon={Music} label="Audio" />
            <Tool onClick={() => pickFiles("application/pdf")} Icon={FileText} label="PDF" />
            <Tool onClick={() => setShowLink((v) => !v)} Icon={LinkIcon} label="Link" active={showLink} />
            <Tool onClick={() => setShowWarning((v) => !v)} Icon={ShieldAlert} label="Warning" active={showWarning} />
            <Tool onClick={() => setPollOn((v) => !v)} Icon={BarChart3} label="Poll" active={pollOn} />
            <Tool onClick={() => setShowFeelings((v) => !v)} Icon={Smile} label="Feeling" active={!!feeling} />
            <Tool onClick={() => setShowSchedule((v) => !v)} Icon={Clock} label="Schedule" active={!!scheduleAt} />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => submit(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> Draft
            </Button>
            <Button
              onClick={() => submit(false)}
              disabled={busy || !uid || (!content.trim() && !files.length && !pollOn && !link.trim())}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {scheduleAt ? "Schedule" : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Tool({ onClick, Icon, label, active }: { onClick: () => void; Icon: any; label: string; active?: boolean }) {
  return (
    <Button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? "border-transparent bg-primary text-primary-foreground" : "bg-background/60 hover:bg-muted"}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </Button>
  );
}
