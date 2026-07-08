import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Users, Check, X, UserPlus, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { notify } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "Friends — SchoolConnect" }] }),
  component: FriendsPage,
});

type Person = { id: string; full_name: string | null; avatar_url: string | null; school_name: string | null; username: string | null };

function FriendsPage() {
  const [tab, setTab] = useState<"friends" | "requests" | "suggestions">("friends");
  const [uid, setUid] = useState("");
  const [friends, setFriends] = useState<Person[]>([]);
  const [requests, setRequests] = useState<{ id: string; requester: Person }[]>([]);
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    const id = u.user?.id;
    if (!id) return;
    setUid(id);

    const { data: rels } = await supabase.from("friendships").select("*").or(`requester_id.eq.${id},addressee_id.eq.${id}`);
    const acceptedIds = (rels ?? []).filter((r: any) => r.status === "accepted").map((r: any) => r.requester_id === id ? r.addressee_id : r.requester_id);
    const pending = (rels ?? []).filter((r: any) => r.status === "pending" && r.addressee_id === id);
    const knownIds = new Set([id, ...(rels ?? []).flatMap((r: any) => [r.requester_id, r.addressee_id])]);

    const [{ data: friendProfiles }, { data: reqProfiles }, { data: allProfiles }] = await Promise.all([
      acceptedIds.length ? supabase.from("profiles").select("id,full_name,avatar_url,school_name,username").in("id", acceptedIds) : Promise.resolve({ data: [] as any[] }),
      pending.length ? supabase.from("profiles").select("id,full_name,avatar_url,school_name,username").in("id", pending.map((p: any) => p.requester_id)) : Promise.resolve({ data: [] as any[] }),
      supabase.from("profiles").select("id,full_name,avatar_url,school_name,username").limit(40),
    ]);
    const rmap = new Map((reqProfiles ?? []).map((p: any) => [p.id, p]));
    setFriends(friendProfiles ?? []);
    setRequests(pending.map((p: any) => ({ id: p.id, requester: rmap.get(p.requester_id) as Person })).filter((x: any) => x.requester));
    setSuggestions((allProfiles ?? []).filter((p: any) => !knownIds.has(p.id)).slice(0, 12));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function accept(rid: string, requesterId: string) {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", rid);
    await notify({ userId: requesterId, actorId: uid, type: "friend_accepted", message: "accepted your friend request" });
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
    await notify({ userId: pid, actorId: uid, type: "friend_request", message: "sent you a friend request" });
    toast.success("Request sent");
    load();
  }
  async function unfriend(otherId: string) {
    if (!confirm("Remove this friend?")) return;
    await supabase.from("friendships").delete().or(`and(requester_id.eq.${uid},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${uid})`);
    toast.success("Removed");
    load();
  }

  return (
    <AppShell>
      <div className="glass mb-4 flex items-center gap-3 rounded-3xl p-5">
        <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand shadow-brand">
          <Users className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-black">Friends</h1>
          <p className="text-sm text-muted-foreground">{friends.length} friends • {requests.length} pending</p>
        </div>
      </div>

      <div className="glass mb-4 inline-flex rounded-full p-1">
        {(["friends", "requests", "suggestions"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-bold capitalize ${tab === t ? "gradient-brand text-primary-foreground shadow-brand" : "text-muted-foreground"}`}>
            {t}{t === "requests" && requests.length > 0 && <span className="ml-1 rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{requests.length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass grid h-40 place-items-center rounded-3xl text-sm text-muted-foreground">Loading…</div>
      ) : tab === "friends" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {friends.length === 0 && <EmptyState msg="No friends yet — send some requests!" />}
          {friends.map((f) => (
            <div key={f.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <PersonAvatar p={f} />
              <div className="min-w-0 flex-1">
                <Link to="/profile/$userId" params={{ userId: f.id }} className="block truncate font-semibold hover:underline">{f.full_name || f.username || "Student"}</Link>
                <div className="truncate text-xs text-muted-foreground">{f.school_name}</div>
              </div>
              <Link to="/messages" search={{ with: f.id }} className="rounded-full border p-2 hover:bg-muted" title="Message"><MessageCircle className="h-4 w-4" /></Link>
              <button onClick={() => unfriend(f.id)} className="rounded-full border p-2 hover:bg-muted" title="Remove"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      ) : tab === "requests" ? (
        <div className="grid gap-3">
          {requests.length === 0 && <EmptyState msg="No pending requests." />}
          {requests.map((r) => (
            <div key={r.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <PersonAvatar p={r.requester} />
              <div className="min-w-0 flex-1">
                <Link to="/profile/$userId" params={{ userId: r.requester.id }} className="block truncate font-semibold hover:underline">{r.requester.full_name || "Student"}</Link>
                <div className="truncate text-xs text-muted-foreground">wants to be friends</div>
              </div>
              <button onClick={() => accept(r.id, r.requester.id)} className="inline-flex items-center gap-1 rounded-full gradient-brand px-3 py-1.5 text-xs font-bold text-primary-foreground"><Check className="h-3.5 w-3.5" /> Accept</button>
              <button onClick={() => decline(r.id)} className="rounded-full border p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.length === 0 && <EmptyState msg="No suggestions right now." />}
          {suggestions.map((p) => (
            <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <PersonAvatar p={p} />
              <div className="min-w-0 flex-1">
                <Link to="/profile/$userId" params={{ userId: p.id }} className="block truncate font-semibold hover:underline">{p.full_name || p.username || "Student"}</Link>
                <div className="truncate text-xs text-muted-foreground">{p.school_name}</div>
              </div>
              <button onClick={() => add(p.id)} className="inline-flex items-center gap-1 rounded-full gradient-brand px-3 py-1.5 text-xs font-bold text-primary-foreground"><UserPlus className="h-3.5 w-3.5" /> Add</button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function PersonAvatar({ p }: { p: Person }) {
  return (
    <Link to="/profile/$userId" params={{ userId: p.id }} className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-sm font-bold text-primary-foreground">
      {p.avatar_url ? <img src={p.avatar_url} className="h-full w-full object-cover" alt="" /> : (p.full_name || "S")[0]}
    </Link>
  );
}
function EmptyState({ msg }: { msg: string }) {
  return <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
