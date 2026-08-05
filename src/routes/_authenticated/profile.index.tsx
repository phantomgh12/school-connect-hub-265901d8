import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VerifiedBadge } from "@/components/app/VerifiedBadge";
import type { Tables } from "@/integrations/supabase/types";
import { AppShell } from "@/components/app/AppShell";
import { PostCard, type FeedPost } from "@/components/app/PostCard";
import { uploadToBucket } from "@/lib/upload";
import { BadgeGrid } from "@/components/app/BadgeGrid";
import {
  GraduationCap, MapPin, Cake, Users, School, Heart, Sparkles,
  Pencil, Loader2, Camera, ImagePlus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile/")({
  head: () => ({ meta: [{ title: "My profile — SchoolConnect" }] }),
  component: ProfilePage,
});

type Profile = Tables<"profiles">;
type Questionnaire = Tables<"student_questionnaire">;

function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [email, setEmail] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [uid, setUid] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    const id = userData.user?.id;
    setEmail(userData.user?.email ?? "");
    if (!id) return;
    setUid(id);
    const [{ data: p }, { data: qq }, { data: rawPosts }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("student_questionnaire").select("*").eq("user_id", id).maybeSingle(),
      supabase.from("posts").select("id,user_id,content,media_urls,post_type,hashtags,created_at").eq("user_id", id).order("created_at", { ascending: false }),
    ]);
    setProfile(p);
    setQ(qq);
    setPosts((rawPosts ?? []).map((pp: any) => ({
      ...pp,
      author: p ? { full_name: p.full_name, username: p.username, avatar_url: p.avatar_url, school_name: p.school_name } : null,
      like_count: 0, comment_count: 0, liked_by_me: false, saved_by_me: false,
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(file: File | undefined, kind: "avatar" | "cover") {
    if (!file || !uid) return;
    setUploading(kind);
    try {
      const url = await uploadToBucket(kind === "avatar" ? "avatars" : "covers", file, uid);
      const patch = kind === "avatar" ? { avatar_url: url } : { cover_url: url };
      const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
      if (error) throw error;
      toast.success(`${kind === "avatar" ? "Profile photo" : "Cover photo"} updated`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="glass grid h-64 place-items-center rounded-3xl">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand)]" />
        </div>
      </AppShell>
    );
  }

  const initials = (profile?.full_name || email || "S").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const photoPosts = posts.filter((p) => p.post_type === "photo");
  const videoPosts = posts.filter((p) => p.post_type === "video");

  return (
    <AppShell>
      {/* Cover + header */}
      <div className="glass overflow-hidden rounded-[2rem]">
        <div className="relative h-40 sm:h-56">
          {profile?.cover_url ? (
            <img src={profile.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="h-full w-full gradient-brand" />
          )}
          <input ref={coverRef} type="file" hidden accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0], "cover")} />
          <button
            onClick={() => coverRef.current?.click()}
            disabled={uploading === "cover"}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-background"
          >
            {uploading === "cover" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            Cover
          </button>
        </div>
        <div className="grid gap-6 px-6 pb-6 pt-4 sm:grid-cols-[auto_1fr_auto] sm:items-end sm:px-8">
          <div className="relative -mt-16 h-28 w-28 sm:h-32 sm:w-32">
            <div className="grid h-full w-full place-items-center overflow-hidden rounded-full border-4 border-background gradient-brand text-3xl font-black text-primary-foreground shadow-brand">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : initials}
            </div>
            <input ref={avatarRef} type="file" hidden accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0], "avatar")} />
            <button
              onClick={() => avatarRef.current?.click()}
              disabled={uploading === "avatar"}
              className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-background bg-[color:var(--brand)] text-primary-foreground shadow"
              title="Change photo"
            >
              {uploading === "avatar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="min-w-0">
            <h1 className="flex min-w-0 items-center gap-2 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
              <span className="truncate">{profile?.full_name || "Your name"}</span>
              <VerifiedBadge verified={profile?.verified} className="h-5 w-5" />
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {profile?.username && <span>@{profile.username}</span>}
              {profile?.school_name && <span className="inline-flex items-center gap-1"><School className="h-4 w-4" />{profile.school_name}</span>}
              {profile?.school_type && (
                <span className="rounded-full bg-[color:var(--brand)]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--brand)]">{profile.school_type}</span>
              )}
            </div>
            {profile?.bio && <p className="mt-3 max-w-2xl text-sm text-foreground/80">{profile.bio}</p>}
          </div>
          <div className="min-w-0 sm:w-72">
            <ProfileStats userId={uid} />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 px-6 py-3 sm:px-8">
          <Link to="/onboarding" className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-4 py-2 text-sm font-semibold hover:bg-muted">
            <Pencil className="h-4 w-4" /> Edit profile
          </Link>
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="glass rounded-3xl p-6 lg:col-span-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Basics</h3>
          <ul className="mt-4 grid gap-3 text-sm">
            <Row icon={GraduationCap} label="School" value={profile?.school_name} />
            <Row icon={Users} label="Class / Grade" value={profile?.grade_class} />
            <Row icon={Cake} label="Birthday" value={profile?.date_of_birth} />
            <Row icon={MapPin} label="Location" value={[profile?.city, profile?.region, profile?.country].filter(Boolean).join(", ")} />
            <Row icon={Users} label="Email" value={email} />
          </ul>
        </section>

        <section className="glass rounded-3xl p-6 lg:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">About me</h3>
          {q ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <QCard icon={Sparkles} label="Favorite subjects" value={q.favorite_subjects} />
              <QCard icon={Heart} label="Hobbies" value={q.hobbies} />
              <QCard icon={Sparkles} label="Inspiration" value={q.inspiration} />
              <QCard icon={GraduationCap} label="Career goal" value={q.career_goal} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Complete onboarding to fill this out.</p>
          )}
        </section>
      </div>

      {/* Photos grid */}
      {photoPosts.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Photos</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photoPosts.flatMap((p) => p.media_urls).slice(0, 12).map((url, i) => (
              <img key={i} src={url} alt="" className="aspect-square w-full rounded-xl object-cover" loading="lazy" decoding="async" />
            ))}
          </div>
        </section>
      )}

      {/* Posts */}
      <section className="mt-6">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Your posts</h3>
        {posts.length === 0 ? (
          <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
            You haven't posted yet. <Link to="/home" className="font-semibold text-[color:var(--brand)]">Create your first post</Link>.
          </div>
        ) : (
          <div className="grid gap-4">
            {posts.map((p) => <PostCard key={p.id} post={p} currentUserId={uid} onChange={load} />)}
          </div>
        )}
      </section>
    {uid && <div className="mt-6"><BadgeGrid userId={uid} /></div>}
    </AppShell>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <li className="flex items-start gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-[color:var(--brand)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{value}</div>
      </div>
    </li>
  );
}

function QCard({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border bg-background/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-[color:var(--brand)]" /> {label}
      </div>
      <div className="mt-1.5 font-semibold">{value}</div>
    </div>
  );
}
