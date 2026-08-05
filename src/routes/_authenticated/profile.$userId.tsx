import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VerifiedBadge } from "@/components/app/VerifiedBadge";
import { AppShell } from "@/components/app/AppShell";
import { PostCard, type FeedPost } from "@/components/app/PostCard";
import { ProfileStats } from "@/components/app/ProfileStats";
import { BadgeGrid } from "@/components/app/BadgeGrid";
import {
  GraduationCap, MapPin, School, MessageCircle, UserPlus, UserCheck, Clock, Loader2,
  Users, Award,
} from "lucide-react";
import { notify } from "@/lib/notify";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile/$userId")({
  head: () => ({
    meta: [
      { title: "Student profile — GH School Hub" },
      { name: "description", content: "See a student's posts, badges, achievements, followers, school and class on GH School Hub." },
      { property: "og:title", content: "Student profile — GH School Hub" },
      { property: "og:description", content: "Posts, badges, followers and school details." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [status, setStatus] = useState<"none" | "pending_sent" | "pending_received" | "friends">("none");
  const [reqId, setReqId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [mutuals, setMutuals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"posts" | "photos" | "badges">("posts");

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const myId = u.user?.id;
    if (!myId) return;
    setMe(myId);
    if (myId === userId) { navigate({ to: "/profile", replace: true }); return; }

    const [{ data: p }, { data: rawPosts }, { data: rel }, follow, mut] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("posts")
        .select("id,user_id,content,media_urls,post_type,hashtags,created_at,likes_count,comments_count,views_count,shares_count,saves_count")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      supabase.from("friendships").select("*")
        .or(`and(requester_id.eq.${myId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${myId})`)
        .maybeSingle(),
      supabase.from("follows").select("follower_id").eq("follower_id", myId).eq("following_id", userId).maybeSingle(),
      supabase.rpc("mutual_friends_count", { _me: myId, _other: userId }),
    ]);

    setProfile(p);
    setFollowing(!!follow.data);
    setMutuals(typeof mut.data === "number" ? mut.data : 0);
    setPosts((rawPosts ?? []).map((pp: any) => ({
      ...pp,
      author: p ? { full_name: p.full_name, username: p.username, avatar_url: p.avatar_url, school_name: p.school_name } : null,
      like_count: pp.likes_count ?? 0,
      comment_count: pp.comments_count ?? 0,
      liked_by_me: false,
      saved_by_me: false,
    })));
    if (rel) {
      setReqId(rel.id);
      if (rel.status === "accepted") setStatus("friends");
      else if (rel.requester_id === myId) setStatus("pending_sent");
      else setStatus("pending_received");
    } else { setStatus("none"); setReqId(null); }
    setLoading(false);
  }, [userId, navigate]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function addFriend() {
    const { error } = await supabase.from("friendships").insert({ requester_id: me, addressee_id: userId, status: "pending" });
    if (error) return toast.error(error.message);
    await notify({ userId, actorId: me, type: "friend_request", message: "sent you a friend request" });
    toast.success("Request sent");
    load();
  }

  async function accept() {
    if (!reqId) return;
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", reqId);
    await notify({ userId, actorId: me, type: "friend_accepted", message: "accepted your friend request" });
    toast.success("You're friends!");
    load();
  }

  async function toggleFollow() {
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", me).eq("following_id", userId);
      setFollowing(false);
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: me, following_id: userId });
      if (error) return toast.error(error.message);
      setFollowing(true);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="grid h-64 place-items-center rounded-2xl border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">This student doesn't exist.</div>
      </AppShell>
    );
  }

  const initials = (profile.full_name || "S").split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();
  const photos = posts.filter((p) => p.post_type === "photo").flatMap((p) => p.media_urls);

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="h-32 w-full bg-muted sm:h-44">
            {profile.cover_url && (
              <img src={profile.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            )}
          </div>

          <div className="grid gap-4 p-4 sm:p-6">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-4">
              <div className="relative -mt-14 h-24 w-24 shrink-0 sm:-mt-16 sm:h-28 sm:w-28">
                <div className="grid h-full w-full place-items-center overflow-hidden rounded-full border-4 border-card bg-primary text-2xl font-black text-primary-foreground">
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.full_name ?? "Student"} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    : initials}
                </div>
                {profile.is_online && <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-card bg-emerald-500" />}
              </div>
              <div className="min-w-0">
                <h1 className="flex min-w-0 items-center gap-2 text-xl font-black tracking-tight sm:text-2xl">
                  <span className="truncate">{profile.full_name || "Student"}</span>
                  <VerifiedBadge verified={profile.verified} className="h-5 w-5 shrink-0" />
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {profile.username && <span className="truncate">@{profile.username}</span>}
                  {profile.school_name && (
                    <span className="inline-flex min-w-0 items-center gap-1"><School className="h-4 w-4 shrink-0" /><span className="truncate">{profile.school_name}</span></span>
                  )}
                  {profile.school_type && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">{profile.school_type}</span>
                  )}
                </div>
              </div>
            </div>

            {profile.bio && <p className="max-w-2xl text-sm text-foreground/80">{profile.bio}</p>}
            {mutuals > 0 && (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> {mutuals} mutual friend{mutuals === 1 ? "" : "s"}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {status === "friends" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-600"><UserCheck className="h-4 w-4" /> Friends</span>
              )}
              {status === "none" && (
                <button onClick={addFriend} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><UserPlus className="h-4 w-4" /> Add friend</button>
              )}
              {status === "pending_sent" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold text-muted-foreground"><Clock className="h-4 w-4" /> Request sent</span>
              )}
              {status === "pending_received" && (
                <button onClick={accept} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><UserCheck className="h-4 w-4" /> Accept request</button>
              )}
              <button onClick={toggleFollow} className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold ${following ? "bg-muted" : "hover:bg-muted"}`}>
                {following ? "Following" : "Follow"}
              </button>
              <Link to="/messages" search={{ with: userId }} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted">
                <MessageCircle className="h-4 w-4" /> Message
              </Link>
            </div>

            <ProfileStats userId={userId} />
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 sm:p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">School details</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            <Row icon={GraduationCap} label="School" value={profile.school_name} />
            <Row icon={School} label="Class / grade" value={profile.grade_class} />
            <Row icon={MapPin} label="Location" value={[profile.city, profile.region, profile.country].filter(Boolean).join(", ")} />
          </ul>
        </section>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {([["posts", "Posts"], ["photos", "Photos"], ["badges", "Badges"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${tab === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === "posts" && (
          posts.length === 0
            ? <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No posts yet.</p>
            : <div className="grid gap-4">{posts.map((p) => <PostCard key={p.id} post={p} currentUserId={me} onChange={load} />)}</div>
        )}

        {tab === "photos" && (
          photos.length === 0
            ? <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">No photos yet.</p>
            : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.slice(0, 24).map((url, i) => (
                  <img key={`${url}-${i}`} src={url} alt="" className="aspect-square w-full rounded-xl object-cover" loading="lazy" decoding="async" />
                ))}
              </div>
            )
        )}

        {tab === "badges" && (
          <div className="grid gap-3">
            <BadgeGrid userId={userId} />
            <Link to="/badges" className="inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold hover:bg-muted">
              <Award className="h-4 w-4" /> Open the badge wall
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <li className="flex min-w-0 items-start gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </li>
  );
}
