import { useEffect, useState } from "react";
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, Trash2, Pencil, Send, Download, Flag, Loader2, Eye, UserPlus, UserCheck, Pin, Globe, Users, School, FileText, ExternalLink, ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { VerifiedBadge } from "@/components/app/VerifiedBadge";
import { PostPoll, type Poll } from "@/components/app/PostPoll";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { readPostOptions, mediaAspectClass } from "@/lib/post-options";

export type FeedPost = {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: string[];
  post_type: string;
  hashtags: string[];
  created_at: string;
  author?: { full_name: string | null; username: string | null; avatar_url: string | null; school_name: string | null } | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
  view_count?: number;
  share_count?: number;
  audience?: string | null;
  feeling?: string | null;
  pinned?: boolean | null;
  poll?: Poll | null;
  options?: unknown;
};

const AUDIENCE_META: Record<string, { icon: typeof Globe; label: string }> = {
  public: { icon: Globe, label: "Everyone" },
  friends: { icon: Users, label: "Friends only" },
  school: { icon: School, label: "My school" },
};

type Comment = {
  id: string; user_id: string; content: string; created_at: string;
  author?: { full_name: string | null; avatar_url: string | null } | null;
};

export function PostCard({ post, currentUserId, onChange }: { post: FeedPost; currentUserId: string; onChange: () => void }) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [saved, setSaved] = useState(post.saved_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [viewCount, setViewCount] = useState(post.view_count ?? 0);
  const [shareCount, setShareCount] = useState(post.share_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [pinned, setPinned] = useState(!!post.pinned);
  const [revealed, setRevealed] = useState(false);
  const options = readPostOptions(post.options);
  const hidden = !!options.warning && !revealed;

  const isMine = post.user_id === currentUserId;
  const audience = AUDIENCE_META[post.audience ?? "public"] ?? { icon: Globe, label: "Everyone" };
  const AudienceIcon = audience.icon;

  async function togglePin() {
    const next = !pinned;
    const { error } = await supabase.from("posts").update({ pinned: next }).eq("id", post.id);
    if (error) return toast.error(error.message);
    setPinned(next);
    toast.success(next ? "Pinned to your profile" : "Unpinned");
  }

  // Register a view once mounted (owner-only viewer list; public counters live on posts)
  useEffect(() => {
    if (!isMine) {
      supabase.from("post_views").upsert({ post_id: post.id, user_id: currentUserId }, { onConflict: "post_id,user_id" }).then(() => {});
      supabase.from("follows").select("follower_id").eq("follower_id", currentUserId).eq("following_id", post.user_id).maybeSingle().then((r) => setIsFollowing(!!r.data));
    }
    // Realtime like/comment/view/share counts via the posts row
    const ch = supabase.channel(`post-${post.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes", filter: `post_id=eq.${post.id}` }, () => {
        supabase.from("post_likes").select("user_id", { count: "exact", head: true }).eq("post_id", post.id).then((r) => setLikeCount(r.count ?? 0));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${post.id}` }, () => {
        supabase.from("post_comments").select("id", { count: "exact", head: true }).eq("post_id", post.id).then((r) => setCommentCount(r.count ?? 0));
        if (showComments) loadComments();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts", filter: `id=eq.${post.id}` }, (payload: any) => {
        if (typeof payload.new?.views_count === "number") setViewCount(payload.new.views_count);
        if (typeof payload.new?.shares_count === "number") setShareCount(payload.new.shares_count);
      })
      .subscribe();
    // Fetch fresh public counts
    supabase.from("posts").select("views_count,shares_count").eq("id", post.id).maybeSingle().then((r) => {
      if (r.data) { setViewCount(r.data.views_count ?? 0); setShareCount(r.data.shares_count ?? 0); }
    });
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  async function toggleLike() {
    setLiked((v) => !v);
    setLikeCount((n) => n + (liked ? -1 : 1));
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    } else {
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: currentUserId });
    }
  }

  async function toggleSave() {
    setSaved((v) => !v);
    if (saved) {
      await supabase.from("post_saves").delete().eq("post_id", post.id).eq("user_id", currentUserId);
      toast.success("Removed from saved");
    } else {
      await supabase.from("post_saves").insert({ post_id: post.id, user_id: currentUserId });
      toast.success("Saved");
    }
  }

  async function toggleFollow() {
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", post.user_id);
      setIsFollowing(false);
      toast.success("Unfollowed");
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: currentUserId, following_id: post.user_id });
      if (error) return toast.error(error.message);
      setIsFollowing(true);
      toast.success("Following");
    }
  }

  async function loadComments() {
    const { data: raw } = await supabase
      .from("post_comments")
      .select("id,user_id,content,created_at")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    const ids = [...new Set((raw ?? []).map((c: any) => c.user_id))];
    const { data: authors } = ids.length
      ? await supabase.from("profiles").select("id,full_name,avatar_url").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((authors ?? []).map((a: any) => [a.id, a]));
    setComments((raw ?? []).map((c: any) => ({ ...c, author: map.get(c.user_id) ?? null })));
  }

  useEffect(() => { if (showComments) loadComments(); }, [showComments]); // eslint-disable-line

  async function addComment() {
    if (!commentText.trim()) return;
    setCommentBusy(true);
    const { error } = await supabase.from("post_comments").insert({ post_id: post.id, user_id: currentUserId, content: commentText.trim() });
    setCommentBusy(false);
    if (error) return toast.error(error.message);
    setCommentText("");
    loadComments();
    onChange();
  }

  async function saveEdit() {
    const { error } = await supabase.from("posts").update({ content: editContent.trim() }).eq("id", post.id);
    if (error) return toast.error(error.message);
    setEditing(false);
    toast.success("Updated");
    onChange();
  }

  async function del() {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onChange();
  }

  async function share() {
    const url = `${window.location.origin}/home#post-${post.id}`;
    await supabase.from("post_shares").insert({ post_id: post.id, user_id: currentUserId });
    setShareCount((n) => n + 1);
    try {
      if (navigator.share) await navigator.share({ title: "SchoolConnect", text: post.content ?? "", url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch {}
  }

  async function downloadMedia(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = url.split("/").pop()?.split("?")[0] || "media";
      a.click();
    } catch { toast.error("Download failed"); }
  }

  const name = post.author?.full_name || post.author?.username || "Student";
  const initials = name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <article id={`post-${post.id}`} className="post-card glass w-full max-w-full rounded-lg p-4 sm:p-5 animate-fade-up">
      <header className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 sm:gap-3">
        <Link to="/profile/$userId" params={{ userId: post.user_id }} className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-background">
          {post.author?.avatar_url ? <img src={post.author.avatar_url} className="h-full w-full object-cover" alt="" loading="lazy" decoding="async" /> : initials}
        </Link>
        <div className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1">
            <Link to="/profile/$userId" params={{ userId: post.user_id }} className="truncate text-sm font-bold hover:underline">{name}</Link>
            <VerifiedBadge userId={post.user_id} className="h-3.5 w-3.5" />
            {post.feeling && <span className="truncate text-xs text-muted-foreground">is feeling {post.feeling}</span>}
            {pinned && <Pin className="h-3 w-3 shrink-0 text-primary" aria-label="Pinned" />}
          </span>
          <div className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
            {post.author?.school_name ? <span className="truncate">{post.author.school_name} •</span> : null}
            <span>{timeAgo(post.created_at)}</span>
            <span aria-hidden>•</span>
            <AudienceIcon className="h-3 w-3 shrink-0" aria-label={audience.label} />
          </div>
        </div>
        {!isMine ? (
          <Button variant="ghost" onClick={toggleFollow} aria-label={isFollowing ? "Unfollow student" : "Follow student"} title={isFollowing ? "Unfollow student" : "Follow student"} className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${isFollowing ? "border bg-background/60 text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
            {isFollowing ? <><UserCheck className="h-3 w-3" /> <span className="hidden xs:inline">Following</span></> : <><UserPlus className="h-3 w-3" /> <span className="hidden xs:inline">Follow</span></>}
          </Button>
        ) : <span />}
        <div className="relative shrink-0">
          <Button variant="ghost" onClick={() => setMenuOpen((v) => !v)} aria-label="Post options" title="Post options" className="rounded-full p-1.5 hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></Button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-40 w-40 overflow-hidden rounded-xl border bg-popover shadow-lg">
              {isMine && (
                <>
                  <Button variant="ghost" onClick={() => { setEditing(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button variant="ghost" onClick={() => { togglePin(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"><Pin className="h-3.5 w-3.5" /> {pinned ? "Unpin" : "Pin"}</Button>
                  <Button variant="ghost" onClick={() => { del(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </>
              )}
              {!isMine && (
                <Button variant="ghost" onClick={() => { toast.success("Reported. Thank you."); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"><Flag className="h-3.5 w-3.5" /> Report</Button>
              )}
            </div>
          )}
        </div>
      </header>


      {options.warning && <div className="mt-4 flex min-w-0 items-center gap-2 border-y py-3"><ShieldAlert className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 break-words text-sm font-medium">{options.warning}</span><Button variant="outline" size="sm" onClick={() => setRevealed((v) => !v)}>{revealed ? "Hide" : "Show post"}</Button></div>}
      {!hidden && <>
      {editing ? (
        <div className="mt-3">
          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} className="w-full rounded-2xl border bg-background/60 p-3 text-sm outline-none" />
          <div className="mt-2 flex gap-2">
            <Button variant="ghost" onClick={saveEdit} className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">Save</Button>
            <Button variant="ghost" onClick={() => setEditing(false)} className="rounded-full border px-4 py-1.5 text-xs font-semibold">Cancel</Button>
          </div>
        </div>
      ) : (
        post.content && (
          <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {renderContent(post.content)}
          </p>
        )
      )}


      {post.media_urls.length > 0 && (
        <div className="mt-3 grid min-w-0 gap-3">
          {post.media_urls.map((url, i) => (
            <div key={i} className="group relative min-w-0">
              {options.attachments?.[i]?.kind === "audio" || /\.(mp3|m4a|wav|ogg|aac|flac)(?:\?|$)/i.test(url) || (post.post_type === "audio" && !options.attachments?.length) ? (
                <div className="min-w-0 rounded-md border bg-muted p-3"><p className="mb-2 truncate text-sm font-medium">{options.attachments?.[i]?.name || "Audio"}</p><audio src={url} controls preload="metadata" className="w-full" /></div>
              ) : options.attachments?.[i]?.kind === "document" || /\.pdf(?:\?|$)/i.test(url) ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-3 rounded-md border p-4 text-primary"><FileText className="size-6 shrink-0" /><span className="min-w-0 flex-1 truncate">{options.attachments?.[i]?.name || "PDF document"}</span><ExternalLink className="size-4 shrink-0" /></a>
              ) : options.attachments?.[i]?.kind === "video" || /\.(mp4|webm|mov)(?:\?|$)/i.test(url) || (post.post_type === "video" && !options.attachments?.length) ? (
                <video src={url} controls preload="metadata" playsInline className={`max-h-[520px] w-full rounded-md bg-media ${mediaAspectClass(options.aspect)}`} />
              ) : (
                <img src={url} alt={options.attachments?.[i]?.description || "Post photo"} className={`max-h-[520px] w-full rounded-md bg-muted ${mediaAspectClass(options.aspect)}`} loading="lazy" />
              )}
              <Button variant="ghost" size="icon" onClick={() => downloadMedia(url)} className="mt-1 bg-background/80" aria-label="Download attachment" title="Download attachment">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {options.link && <a href={options.link} target="_blank" rel="noopener noreferrer" className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border p-3 text-sm text-primary"><span className="truncate">{options.link}</span><ExternalLink className="size-4 shrink-0" /></a>}

      {post.poll && (
        <div className="mt-3">
          <PostPoll postId={post.id} poll={post.poll} currentUserId={currentUserId} />
        </div>
      )}

      {post.hashtags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.hashtags.map((h) => (
            <Link key={h} to="/search" search={{ q: `#${h}` }} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-primary hover:bg-accent">#{h}</Link>
          ))}
        </div>
      )}
      </>}

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {viewCount} view{viewCount === 1 ? "" : "s"}</span>
        {shareCount > 0 && <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3" /> {shareCount} share{shareCount === 1 ? "" : "s"}</span>}
      </div>

      <footer className="mt-3 grid grid-cols-4 items-center gap-1 border-t border-border pt-3">
        <Button variant="ghost" onClick={toggleLike} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold transition ${liked ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}>
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {likeCount}
        </Button>
        <Button variant="ghost" onClick={() => setShowComments((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <MessageCircle className="h-4 w-4" /> {commentCount}
        </Button>
        <Button variant="ghost" onClick={share} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span>
        </Button>
        <Button variant="ghost" onClick={toggleSave} aria-label={saved ? "Unsave post" : "Save post"} title={saved ? "Unsave post" : "Save post"} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold transition ${saved ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
        </Button>
      </footer>

      {showComments && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="grid gap-3">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-xs font-bold text-primary-foreground">
                  {c.author?.avatar_url ? <img src={c.author.avatar_url} className="h-full w-full object-cover" alt="" loading="lazy" decoding="async" /> : (c.author?.full_name || "S")[0]}
                </div>
                <div className="min-w-0 flex-1 rounded-2xl bg-muted/60 px-3 py-2">
                  <div className="truncate text-xs font-bold">{c.author?.full_name || "Student"}</div>
                  <div className="text-sm">{c.content}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
              placeholder="Write a comment…"
              className="min-w-0 flex-1 rounded-md border bg-background/60 px-4 py-2 text-sm outline-none"
            />
            <Button variant="ghost" onClick={addComment} aria-label="Send comment" disabled={commentBusy} className="rounded-full gradient-brand p-2 text-primary-foreground shadow-brand disabled:opacity-50">
              {commentBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function renderContent(text: string) {
  const parts = text.split(/(#[\p{L}0-9_]+|@[\p{L}0-9_]+)/gu);
  return parts.map((p, i) => {
    if (p.startsWith("#")) return <span key={i} className="font-semibold text-primary">{p}</span>;
    if (p.startsWith("@")) return <span key={i} className="font-semibold text-primary">{p}</span>;
    return <span key={i}>{p}</span>;
  });
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}
