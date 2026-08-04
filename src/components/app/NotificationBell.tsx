import { Link } from "@tanstack/react-router";
import { Bell, Check, Heart, MessageCircle, UserPlus, Bookmark, Share2, BadgeCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type N = {
  id: string;
  type: string;
  message: string | null;
  read: boolean;
  created_at: string;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
};

const ICONS: Record<string, typeof Bell> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  friend_request: UserPlus,
  friend_accepted: UserPlus,
  save: Bookmark,
  share: Share2,
  invite_confirmed: BadgeCheck,
};

function timeAgo(iso: string) {
  const s = Math.max((Date.now() - new Date(iso).getTime()) / 1000, 0);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Bell + in-app notification panel with realtime pushes. */
export function NotificationBell({ uid, unread, onRead }: { uid: string; unread: number; onRead: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);
  const [actors, setActors] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const loaded = useRef(false);

  async function load() {
    if (!uid) return;
    // Light payload: only the columns the panel renders, newest 12 rows.
    const { data } = await supabase
      .from("notifications")
      .select("id,type,message,read,created_at,actor_id,entity_type,entity_id")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(12);
    const rows = (data ?? []) as N[];
    setItems(rows);
    const ids = [...new Set(rows.map((n) => n.actor_id).filter(Boolean))] as string[];
    const missing = ids.filter((id) => !actors[id]);
    if (missing.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,avatar_url").in("id", missing);
      setActors((prev) => ({ ...prev, ...Object.fromEntries((profs ?? []).map((p: any) => [p.id, p])) }));
    }
    loaded.current = true;
  }

  // Realtime: surface every new notification instantly in the panel + a toast.
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`bell-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        async (payload) => {
          const n = payload.new as N;
          setItems((prev) => [n, ...prev].slice(0, 12));
          if (n.actor_id && !actors[n.actor_id]) {
            const { data: p } = await supabase.from("profiles").select("id,full_name,avatar_url").eq("id", n.actor_id).maybeSingle();
            if (p) setActors((prev) => ({ ...prev, [p.id]: p as any }));
          }
          toast(n.message ?? "New notification", { description: "Tap the bell to see all activity" });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded.current) await load();
  }

  async function markAll() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", uid).eq("read", false);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    onRead();
  }

  return (
    <div className="relative">
      <button onClick={toggle} aria-label="Notifications" aria-expanded={open} className="press relative rounded-full p-2 hover:bg-muted">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div className="glass animate-fade-up absolute right-0 z-50 mt-2 max-h-[70dvh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl p-2 no-scrollbar">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <p className="text-sm font-bold">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-primary hover:bg-muted">
                  <Check className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing yet — go say hi to someone.</p>
            ) : (
              <ul className="grid gap-0.5">
                {items.map((n) => {
                  const Icon = ICONS[n.type] ?? Bell;
                  const actor = n.actor_id ? actors[n.actor_id] : null;
                  return (
                    <li key={n.id}>
                      <Link
                        to={n.entity_type === "user" && n.entity_id ? "/profile/$userId" : "/notifications"}
                        {...(n.entity_type === "user" && n.entity_id ? { params: { userId: n.entity_id } } : {})}
                        onClick={() => setOpen(false)}
                        className={`flex items-start gap-2.5 rounded-xl p-2 text-left hover:bg-muted ${n.read ? "" : "bg-accent/60"}`}
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {actor?.avatar_url ? (
                            <img src={actor.avatar_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 text-xs leading-snug">
                          <span className="font-bold">{actor?.full_name ?? "SchoolConnect"}</span>{" "}
                          <span className="text-muted-foreground break-words">{n.message ?? n.type}</span>
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link to="/notifications" onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-2 py-2 text-center text-xs font-bold text-primary hover:bg-muted">
              See all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
