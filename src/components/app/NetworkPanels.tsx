import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, UserPlus, Users, Heart, FileText, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { notify } from "@/lib/notify";

/** Compact "Your network" stats — friends, followers, following, posts, likes received. */
export function NetworkStatsCard({ userId }: { userId: string }) {
  const [s, setS] = useState({ friends: 0, followers: 0, following: 0, posts: 0, likes: 0 });

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const [f1, f2, followers, following, posts] = await Promise.all([
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("requester_id", userId).eq("status", "accepted"),
        supabase.from("friendships").select("id", { count: "exact", head: true }).eq("addressee_id", userId).eq("status", "accepted"),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      const { data: myPosts } = await supabase.from("posts").select("id").eq("user_id", userId).limit(200);
      const ids = (myPosts ?? []).map((p: any) => p.id);
      const { count: likes } = ids.length
        ? await supabase.from("post_likes").select("id", { count: "exact", head: true }).in("post_id", ids)
        : { count: 0 };
      if (!alive) return;
      setS({
        friends: (f1.count ?? 0) + (f2.count ?? 0),
        followers: followers.count ?? 0,
        following: following.count ?? 0,
        posts: posts.count ?? 0,
        likes: likes ?? 0,
      });
    })();
    return () => { alive = false; };
  }, [userId]);

  const items = [
    { label: "Friends", value: s.friends, icon: Users },
    { label: "Followers", value: s.followers, icon: UserCheck },
    { label: "Posts", value: s.posts, icon: FileText },
    { label: "Likes", value: s.likes, icon: Heart },
  ];

  return (
    <div className="glass rounded-1xl p-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Your network</h3>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.label} className="rounded-1xl bg-muted/50 p-3">
            <it.icon className="h-4 w-4 text-[color:var(--brand)]" />
            <div className="mt-1 text-lg font-black leading-none">{it.value}</div>
            <div className="text-[11px] text-muted-foreground">{it.label}</div>
          </div>
        ))}
      </div>
      <Link to="/friends" className="mt-3 flex items-center justify-center rounded-full border py-2 text-xs font-bold hover:bg-muted">
        Grow your network
      </Link>
    </div>
  );
}

/** People from the same school (matched on normalized school_slug). */
export function SchoolCommunityCard({ userId }: { userId: string }) {
  const [school, setSchool] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  async function load() {
    const { data: me } = await supabase.from("profiles").select("school_name,school_slug").eq("id", userId).maybeSingle();
    if (!me?.school_slug) { setSchool(null); return; }
    setSchool(me.school_name ?? null);
    const [{ data: list }, { count }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,username,avatar_url,is_online").eq("school_slug", me.school_slug).neq("id", userId).limit(6),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("school_slug", me.school_slug),
    ]);
    setMembers(list ?? []);
    setTotal(count ?? 0);
  }

  useEffect(() => { if (userId) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  async function addFriend(id: string) {
    const { error } = await supabase.from("friendships").insert({ requester_id: userId, addressee_id: id, status: "pending" });
    if (error) return toast.error(error.message);
    await notify({ userId: id, actorId: userId, type: "friend_request", message: "sent you a friend request" });
    toast.success("Friend request sent");
  }

  if (!school) return null;

  return (
    <div className="glass rounded-1xl p-5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <GraduationCap className="h-4 w-4" /> Your school
      </h3>
      <p className="mb-3 truncate text-sm font-bold">{school} <span className="font-medium text-muted-foreground">· {total} member{total === 1 ? "" : "s"}</span></p>
      <ul className="grid gap-3">
        {members.length === 0 && <li className="text-sm text-muted-foreground">You're the first one here — invite your classmates!</li>}
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <Link to="/profile/$userId" params={{ userId: m.id }} className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-xs font-bold text-primary-foreground">
              {m.avatar_url ? <img src={m.avatar_url} className="h-full w-full object-cover" alt="" loading="lazy" decoding="async" /> : (m.full_name || "S")[0]}
            </Link>
            <Link to="/profile/$userId" params={{ userId: m.id }} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
              {m.full_name || m.username || "Student"}
            </Link>
            <button onClick={() => addFriend(m.id)} title="Add friend" className="shrink-0 rounded-full border p-1.5 hover:bg-muted">
              <UserPlus className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
