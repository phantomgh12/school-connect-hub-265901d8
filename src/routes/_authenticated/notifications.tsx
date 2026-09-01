import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — SchoolConnect" }] }),
  component: NotificationsPage,
});

type N = { id: string; type: string; message: string | null; read: boolean; created_at: string; actor_id: string | null; entity_type: string | null; entity_id: string | null };

function NotificationsPage() {
  const [items, setItems] = useState<N[]>([]);
  const [actors, setActors] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState("");

  async function load(id?: string) {
    const userId = id ?? uid;
    if (!userId) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    setItems(data ?? []);
    const actorIds = [...new Set((data ?? []).map((n: any) => n.actor_id).filter(Boolean))];
    if (actorIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,avatar_url").in("id", actorIds);
      setActors(Object.fromEntries((profs ?? []).map((p: any) => [p.id, p])));
    }
    setLoading(false);
  }

  useEffect(() => {
    let ch: any;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      load(data.user.id);
      ch = supabase.channel(`notif-${data.user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${data.user!.id}` }, () => load(data.user!.id))
        .subscribe();
    });
    return () => { if (ch) supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markAll() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", uid).eq("read", false);
    toast.success("Marked all as read");
    load();
  }

  async function markOne(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, read: true } : i));
  }

  const unreadCount = items.filter(i => !i.read).length;

  const iconFor = (type: string) => {
    if (type.includes("like")) return "❤️";
    if (type.includes("comment")) return "💬";
    if (type.includes("follow")) return "➕";
    if (type.includes("friend_request")) return "👋";
    if (type.includes("friend_accepted")) return "🎉";
    if (type.includes("share")) return "🔁";
    if (type.includes("save")) return "🔖";
    if (type.includes("story")) return "✨";
    if (type.includes("message")) return "💌";
    return "🔔";
  };

  return (
    <AppShell>
      <div className="glass mb-4 flex items-center gap-3 rounded-3xl p-5">
        <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand shadow-brand">
          <Bell className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-black">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAll} className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted">
            <Check className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="glass grid h-40 place-items-center rounded-3xl text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">You're all caught up ✨</div>
      ) : (
        <ul className="grid gap-2">
          {items.map((n) => {
            const actor = n.actor_id ? actors[n.actor_id] : null;
            return (
              <li key={n.id}>
                <button onClick={() => markOne(n.id)} className={`glass flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-muted ${!n.read ? "border-l-4 border-[color:var(--brand)]" : ""}`}>
                  <span className="text-xl">{iconFor(n.type)}</span>
                  <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-xs font-bold text-primary-foreground">
                    {actor?.avatar_url ? <img src={actor.avatar_url} className="h-full w-full object-cover" alt="" loading="lazy" decoding="async" /> : (actor?.full_name || "•")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      {actor ? <Link to="/profile/$userId" params={{ userId: actor.id }} className="font-bold hover:underline">{actor.full_name || "Someone"}</Link> : <span className="font-bold">SchoolConnect</span>}{" "}
                      <span className="text-muted-foreground">{n.message ?? n.type.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-[color:var(--brand)]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
