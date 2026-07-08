import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { PostCard, type FeedPost } from "@/components/app/PostCard";
import { GraduationCap, MapPin, School, MessageCircle, UserPlus, UserCheck, Clock, Loader2, Circle } from "lucide-react";
import { notify } from "@/lib/notify";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile/$userId")({
  head: () => ({ meta: [{ title: "Profile — SchoolConnect" }] }),
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
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    const myId = u.user?.id;
    if (!myId) return;
    setMe(myId);
    if (myId === userId) { navigate({ to: "/profile", replace: true }); return; }

    const [{ data: p }, { data: rawPosts }, { data: rel }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("posts").select("id,user_id,content,media_urls,post_type,hashtags,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("friendships").select("*").or(`and(requester_id.eq.${myId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${myId})`).maybeSingle(),
    ]);
    setProfile(p);
    setPosts((rawPosts ?? []).map((pp: any) => ({
      ...pp, author: p ? { full_name: p.full_name, username: p.username, avatar_url: p.avatar_url, school_name: p.school_name } : null,
      like_count: 0, comment_count: 0, liked_by_me: false, saved_by_me: false,
    })));
    if (rel) {
      setReqId(rel.id);
      if (rel.status === "accepted") setStatus("friends");
      else if (rel.requester_id === myId) setStatus("pending_sent");
      else setStatus("pending_received");
    } else {
      setStatus("none"); setReqId(null);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

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

  if (loading) return <AppShell><div className="glass grid h-64 place-items-center rounded-3xl"><Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand)]" /></div></AppShell>;
  if (!profile) return <AppShell><div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">This student doesn't exist.</div></AppShell>;

  const initials = (profile.full_name || "S").split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <div className="glass overflow-hidden rounded-[2rem]">
        <div className="h-40 sm:h-56">
          {profile.cover_url ? <img src={profile.cover_url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full gradient-brand" />}
        </div>
        <div className="grid gap-6 px-6 pb-6 pt-4 sm:grid-cols-[auto_1fr_auto] sm:items-end sm:px-8">
          <div className="relative -mt-16 h-28 w-28 sm:h-32 sm:w-32">
            <div className="grid h-full w-full place-items-center overflow-hidden rounded-full border-4 border-background gradient-brand text-3xl font-black text-primary-foreground shadow-brand">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
            </div>
            {profile.is_online && <Circle className="absolute bottom-2 right-2 h-5 w-5 fill-emerald-500 text-emerald-500 drop-shadow" />}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-black tracking-tight sm:text-4xl">{profile.full_name || "Student"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {profile.username && <span>@{profile.username}</span>}
              {profile.school_name && <span className="inline-flex items-center gap-1"><School className="h-4 w-4" />{profile.school_name}</span>}
              {profile.school_type && <span className="rounded-full bg-[color:var(--brand)]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--brand)]">{profile.school_type}</span>}
            </div>
            {profile.bio && <p className="mt-3 max-w-2xl text-sm text-foreground/80">{profile.bio}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "friends" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-600"><UserCheck className="h-4 w-4" /> Friends</span>
            )}
            {status === "none" && (
              <button onClick={addFriend} className="inline-flex items-center gap-1.5 rounded-full gradient-brand px-4 py-2 text-sm font-bold text-primary-foreground shadow-brand"><UserPlus className="h-4 w-4" /> Add friend</button>
            )}
            {status === "pending_sent" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold text-muted-foreground"><Clock className="h-4 w-4" /> Request sent</span>
            )}
            {status === "pending_received" && (
              <button onClick={accept} className="inline-flex items-center gap-1.5 rounded-full gradient-brand px-4 py-2 text-sm font-bold text-primary-foreground shadow-brand"><UserCheck className="h-4 w-4" /> Accept request</button>
            )}
            <Link to="/messages" search={{ with: userId }} className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-4 py-2 text-sm font-semibold hover:bg-muted"><MessageCircle className="h-4 w-4" /> Message</Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="glass rounded-3xl p-6 lg:col-span-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Basics</h3>
          <ul className="mt-4 grid gap-3 text-sm">
            <Row icon={GraduationCap} label="School" value={profile.school_name} />
            <Row icon={School} label="Class" value={profile.grade_class} />
            <Row icon={MapPin} label="Location" value={[profile.city, profile.region, profile.country].filter(Boolean).join(", ")} />
          </ul>
        </section>
        <section className="glass rounded-3xl p-6 lg:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Posts</h3>
          {posts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            <div className="mt-4 grid gap-4">
              {posts.map((p) => <PostCard key={p.id} post={p} currentUserId={me} onChange={load} />)}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <li className="flex items-start gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-[color:var(--brand)]"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate font-medium">{value}</div>
      </div>
    </li>
  );
}
