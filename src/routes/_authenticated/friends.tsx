import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Users, Check, X, UserPlus, MessageCircle, Search, UserCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "Friends — SchoolConnect" }] }),
  component: FriendsPage,
});

type Person = { id: string; full_name: string | null; avatar_url: string | null; school_name: string | null; username: string | null; grade_class?: string | null };
type PersonWithMutual = Person & { mutual: number };

function FriendsPage() {
  const [tab, setTab] = useState<"friends" | "requests" | "suggestions" | "following" | "followers">("friends");
  const [uid, setUid] = useState("");
  const [friends, setFriends] = useState<Person[]>([]);
  const [requests, setRequests] = useState<{ id: string; requester: Person; mutual: number }[]>([]);
  const [suggestions, setSuggestions] = useState<PersonWithMutual[]>([]);
  const [following, setFollowing] = useState<Person[]>([]);
  const [followers, setFollowers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    const id = u.user?.id;
    if (!id) return;
    setUid(id);

    const [{ data: rels }, { data: followingRows }, { data: followerRows }] = await Promise.all([
      supabase.from("friendships").select("*").or(`requester_id.eq.${id},addressee_id.eq.${id}`),
      supabase.from("follows").select("following_id").eq("follower_id", id),
      supabase.from("follows").select("follower_id").eq("following_id", id),
    ]);
    const acceptedIds = (rels ?? []).filter((r: any) => r.status === "accepted").map((r: any) => r.requester_id === id ? r.addressee_id : r.requester_id);
    const pending = (rels ?? []).filter((r: any) => r.status === "pending" && r.addressee_id === id);
    const knownIds = new Set([id, ...(rels ?? []).flatMap((r: any) => [r.requester_id, r.addressee_id])]);
    const followingIds = (followingRows ?? []).map((r: any) => r.following_id);
    const followerIds = (followerRows ?? []).map((r: any) => r.follower_id);

    const [{ data: friendProfiles }, { data: reqProfiles }, { data: allProfiles }, { data: followingProfiles }, { data: followerProfiles }] = await Promise.all([
      acceptedIds.length ? supabase.from("profiles").select("id,full_name,avatar_url,school_name,username,grade_class").in("id", acceptedIds) : Promise.resolve({ data: [] as any[] }),
      pending.length ? supabase.from("profiles").select("id,full_name,avatar_url,school_name,username,grade_class").in("id", pending.map((p: any) => p.requester_id)) : Promise.resolve({ data: [] as any[] }),
      supabase.from("profiles").select("id,full_name,avatar_url,school_name,username,grade_class").limit(60),
      followingIds.length ? supabase.from("profiles").select("id,full_name,avatar_url,school_name,username").in("id", followingIds) : Promise.resolve({ data: [] as any[] }),
      followerIds.length ? supabase.from("profiles").select("id,full_name,avatar_url,school_name,username").in("id", followerIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const rmap = new Map((reqProfiles ?? []).map((p: any) => [p.id, p]));
    setFriends(friendProfiles ?? []);
    setFollowing(followingProfiles ?? []);
    setFollowers(followerProfiles ?? []);

    // mutual friend counts
    const suggPool = (allProfiles ?? []).filter((p: any) => !knownIds.has(p.id));
    const suggWithMutual: PersonWithMutual[] = await Promise.all(
      suggPool.slice(0, 20).map(async (p: any) => {
        const { data } = await supabase.rpc("mutual_friends_count", { _me: id, _other: p.id });
        return { ...p, mutual: Number(data ?? 0) };
      })
    );
    suggWithMutual.sort((a, b) => b.mutual - a.mutual);
    setSuggestions(suggWithMutual);

    const reqWithMutual = await Promise.all(pending.map(async (p: any) => {
      const requester = rmap.get(p.requester_id) as Person;
      if (!requester) return null;
      const { data } = await supabase.rpc("mutual_friends_count", { _me: id, _other: p.requester_id });
      return { id: p.id, requester, mutual: Number(data ?? 0) };
    }));
    setRequests(reqWithMutual.filter(Boolean) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
    let ch: any;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      ch = supabase.channel(`friends-${u.user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => load())
        .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, () => load())
        .subscribe();
    })();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, []);

  async function accept(rid: string) {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", rid);
    toast.success("Friend added!");
    load();
  }
  async function decline(rid: string) {
    await supabase.from("friendships").delete().eq("id", rid);
    toast.success("Declined");
    load();
  }
  async function add(pid: string) {
    const { error } = await supabase.from("friendships").insert({ requester_id: uid, addressee_id: pid, status: "pending" });
    if (error) return toast.error(error.message);
    // trigger a notification too
    await supabase.from("notifications").insert({ user_id: pid, actor_id: uid, type: "friend_request", message: "sent you a friend request", entity_type: "user", entity_id: uid });
    toast.success("Request sent");
    load();
  }
  async function unfriend(otherId: string) {
    if (!confirm("Remove this friend?")) return;
    await supabase.from("friendships").delete().or(`and(requester_id.eq.${uid},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${uid})`);
    toast.success("Removed");
    load();
  }
  async function unfollow(pid: string) {
    await supabase.from("follows").delete().eq("follower_id", uid).eq("following_id", pid);
    toast.success("Unfollowed");
    load();
  }
  async function follow(pid: string) {
    const { error } = await supabase.from("follows").insert({ follower_id: uid, following_id: pid });
    if (error) return toast.error(error.message);
    toast.success("Following");
    load();
  }

  const q = query.toLowerCase().trim();
  function match<T extends Person>(list: T[]) {
    if (!q) return list;
    return list.filter(p => (p.full_name ?? "").toLowerCase().includes(q) || (p.username ?? "").toLowerCase().includes(q) || (p.school_name ?? "").toLowerCase().includes(q));
  }
  const filteredFriends = useMemo(() => match(friends), [friends, q]);
  const filteredSug = useMemo(() => match(suggestions), [suggestions, q]);
  const filteredFollowing = useMemo(() => match(following), [following, q]);
  const filteredFollowers = useMemo(() => match(followers), [followers, q]);

  return (
    <AppShell>
      <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-3xl p-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-brand shadow-brand">
          <Users className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black">Friends & Following</h1>
          <p className="text-sm text-muted-foreground">{friends.length} friends • {following.length} following • {followers.length} followers</p>
        </div>
      </div>

      <div className="glass mb-3 flex items-center gap-2 rounded-full border bg-background/60 px-4 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search friends by name, username or school…" className="flex-1 bg-transparent text-sm outline-none" />
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {([
          ["friends", `Friends (${friends.length})`],
          ["requests", `Requests (${requests.length})`],
          ["suggestions", "Suggested"],
          ["following", `Following (${following.length})`],
          ["followers", `Followers (${followers.length})`],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${tab === t ? "gradient-brand text-primary-foreground shadow-brand" : "border bg-background/60 text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass grid h-40 place-items-center rounded-3xl text-sm text-muted-foreground">Loading…</div>
      ) : tab === "friends" ? (
        <List items={filteredFriends} emptyMsg="No friends yet — check suggestions!" renderAction={(f) => (
          <>
            <Link to="/messages" search={{ with: f.id }} className="rounded-full border p-2 hover:bg-muted" title="Message"><MessageCircle className="h-4 w-4" /></Link>
            <button onClick={() => unfriend(f.id)} className="rounded-full border p-2 hover:bg-muted" title="Remove"><X className="h-4 w-4" /></button>
          </>
        )} />
      ) : tab === "requests" ? (
        <div className="grid gap-3">
          {requests.length === 0 && <Empty msg="No pending requests." />}
          {requests.map((r) => (
            <div key={r.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <Avatar p={r.requester} />
              <div className="min-w-0 flex-1">
                <Link to="/profile/$userId" params={{ userId: r.requester.id }} className="block truncate font-semibold hover:underline">{r.requester.full_name || "Student"}</Link>
                <div className="truncate text-xs text-muted-foreground">wants to be friends {r.mutual > 0 && `• ${r.mutual} mutual`}</div>
              </div>
              <button onClick={() => accept(r.id)} className="inline-flex items-center gap-1 rounded-full gradient-brand px-3 py-1.5 text-xs font-bold text-primary-foreground"><Check className="h-3.5 w-3.5" /> Accept</button>
              <button onClick={() => decline(r.id)} className="rounded-full border p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      ) : tab === "suggestions" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredSug.length === 0 && <Empty msg="No suggestions right now." />}
          {filteredSug.map((p) => (
            <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <Avatar p={p} />
              <div className="min-w-0 flex-1">
                <Link to="/profile/$userId" params={{ userId: p.id }} className="block truncate font-semibold hover:underline">{p.full_name || p.username || "Student"}</Link>
                <div className="truncate text-xs text-muted-foreground">
                  {p.mutual > 0 ? <span className="font-semibold text-[color:var(--brand)]"><Sparkles className="inline h-3 w-3" /> {p.mutual} mutual friend{p.mutual > 1 ? "s" : ""}</span> : p.school_name || "SchoolConnect"}
                </div>
              </div>
              <button onClick={() => follow(p.id)} className="rounded-full border p-2 hover:bg-muted" title="Follow"><UserCheck className="h-4 w-4" /></button>
              <button onClick={() => add(p.id)} className="inline-flex items-center gap-1 rounded-full gradient-brand px-3 py-1.5 text-xs font-bold text-primary-foreground"><UserPlus className="h-3.5 w-3.5" /> Add</button>
            </div>
          ))}
        </div>
      ) : tab === "following" ? (
        <List items={filteredFollowing} emptyMsg="You're not following anyone yet." renderAction={(f) => (
          <button onClick={() => unfollow(f.id)} className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Unfollow</button>
        )} />
      ) : (
        <List items={filteredFollowers} emptyMsg="No followers yet." renderAction={(f) => (
          <Link to="/messages" search={{ with: f.id }} className="rounded-full border p-2 hover:bg-muted"><MessageCircle className="h-4 w-4" /></Link>
        )} />
      )}
    </AppShell>
  );
}

function List({ items, emptyMsg, renderAction }: { items: Person[]; emptyMsg: string; renderAction: (p: Person) => React.ReactNode }) {
  if (items.length === 0) return <Empty msg={emptyMsg} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((f) => (
        <div key={f.id} className="glass flex items-center gap-3 rounded-2xl p-3">
          <Avatar p={f} />
          <div className="min-w-0 flex-1">
            <Link to="/profile/$userId" params={{ userId: f.id }} className="block truncate font-semibold hover:underline">{f.full_name || f.username || "Student"}</Link>
            <div className="truncate text-xs text-muted-foreground">{f.school_name || (f.username ? `@${f.username}` : "")}</div>
          </div>
          {renderAction(f)}
        </div>
      ))}
    </div>
  );
}
function Avatar({ p }: { p: Person }) {
  return (
    <Link to="/profile/$userId" params={{ userId: p.id }} className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-sm font-bold text-primary-foreground">
      {p.avatar_url ? <img src={p.avatar_url} className="h-full w-full object-cover" alt="" /> : (p.full_name || "S")[0]}
    </Link>
  );
}
function Empty({ msg }: { msg: string }) {
  return <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
