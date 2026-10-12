import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import {
  MessageCircle, Send, ArrowLeft, Loader2, Search, Pin, PinOff, Check, CheckCheck,
} from "lucide-react";
import { notify } from "@/lib/notify";
import { trackMission } from "@/lib/gamification";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({ with: z.string().optional() });

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Messages — GH School Hub" },
      { name: "description", content: "Chat with classmates and friends in real time: typing status, read receipts, pinned chats and unread badges." },
      { property: "og:title", content: "Messages — GH School Hub" },
      { property: "og:description", content: "Real-time chats with classmates and friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

type Convo = {
  id: string;
  other: { id: string; full_name: string | null; avatar_url: string | null; is_online: boolean | null };
  last_message_at: string;
  preview?: string;
  unread?: number;
};
type Msg = { id: string; content: string; sender_id: string; created_at: string; read: boolean };

const PIN_KEY = "gsh:pinned-chats";

function loadPins(): string[] {
  try { return JSON.parse(localStorage.getItem(PIN_KEY) ?? "[]"); } catch { return []; }
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function MessagesPage() {
  const { with: targetUser } = Route.useSearch();
  const [uid, setUid] = useState("");
  const [convos, setConvos] = useState<Convo[]>([]);
  const [active, setActive] = useState<Convo | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [pins, setPins] = useState<string[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => { setPins(loadPins()); }, []);

  function togglePin(id: string) {
    setPins((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      localStorage.setItem(PIN_KEY, JSON.stringify(next));
      return next;
    });
  }

  const loadConvos = useCallback(async (myId: string) => {
    const { data: rows } = await supabase.from("conversations").select("*")
      .or(`user_a.eq.${myId},user_b.eq.${myId}`).order("last_message_at", { ascending: false });
    const otherIds = (rows ?? []).map((c: any) => (c.user_a === myId ? c.user_b : c.user_a));
    const { data: people } = otherIds.length
      ? await supabase.from("profiles").select("id,full_name,avatar_url,is_online").in("id", otherIds)
      : { data: [] as any[] };
    const pmap = new Map((people ?? []).map((p: any) => [p.id, p]));
    const previews: Record<string, string> = {};
    const unreads: Record<string, number> = {};
    if ((rows ?? []).length) {
      const cIds = (rows ?? []).map((r: any) => r.id);
      const { data: lastMsgs } = await supabase.from("messages")
        .select("conversation_id,content,sender_id,read")
        .in("conversation_id", cIds).order("created_at", { ascending: false }).limit(200);
      lastMsgs?.forEach((m: any) => {
        if (!previews[m.conversation_id]) previews[m.conversation_id] = m.content;
        if (m.sender_id !== myId && !m.read) unreads[m.conversation_id] = (unreads[m.conversation_id] ?? 0) + 1;
      });
    }
    setConvos((rows ?? []).map((r: any) => ({
      id: r.id,
      other: pmap.get(r.user_a === myId ? r.user_b : r.user_a) ?? {
        id: r.user_a === myId ? r.user_b : r.user_a, full_name: null, avatar_url: null, is_online: false,
      },
      last_message_at: r.last_message_at,
      preview: previews[r.id],
      unread: unreads[r.id] ?? 0,
    })));
  }, []);

  const loadMessages = useCallback(async (convoId: string, myId: string) => {
    const { data } = await supabase.from("messages").select("*")
      .eq("conversation_id", convoId).order("created_at", { ascending: true }).limit(300);
    setMsgs((data ?? []) as Msg[]);
    await supabase.from("messages").update({ read: true })
      .eq("conversation_id", convoId).neq("sender_id", myId).eq("read", false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const openConversationWith = useCallback(async (myId: string, otherId: string) => {
    const [ua, ub] = orderedPair(myId, otherId);
    let { data: existing } = await supabase.from("conversations").select("*").eq("user_a", ua).eq("user_b", ub).maybeSingle();
    if (!existing) {
      const { data: created, error } = await supabase.from("conversations").insert({ user_a: ua, user_b: ub }).select("*").single();
      if (error) { toast.error(error.message); return; }
      existing = created;
    }
    const { data: other } = await supabase.from("profiles").select("id,full_name,avatar_url,is_online").eq("id", otherId).maybeSingle();
    if (!existing) return;
    const convo: Convo = {
      id: existing.id,
      other: other ?? { id: otherId, full_name: null, avatar_url: null, is_online: false },
      last_message_at: existing.last_message_at,
    };
    setActive(convo);
    await loadConvos(myId);
    await loadMessages(convo.id, myId);
  }, [loadConvos, loadMessages]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const id = u.user?.id;
      if (!id) return;
      setUid(id);
      await loadConvos(id);
      if (targetUser) await openConversationWith(id, targetUser);
      setLoading(false);
    })();
  }, [targetUser, loadConvos, openConversationWith]);

  // Realtime messages + typing presence for the active conversation
  useEffect(() => {
    if (!active || !uid) return;
    setOtherTyping(false);
    const ch = supabase.channel(`msg-${active.id}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${active.id}` }, (payload: any) => {
        setMsgs((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        setOtherTyping(false);
        if (payload.new.sender_id !== uid) {
          supabase.from("messages").update({ read: true }).eq("id", payload.new.id).then(() => {});
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${active.id}` }, (payload: any) => {
        setMsgs((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)));
      })
      .on("broadcast", { event: "typing" }, ({ payload }: any) => {
        if (payload?.user === uid) return;
        setOtherTyping(true);
        setTimeout(() => setOtherTyping(false), 3000);
      })
      .subscribe();
    typingChannel.current = ch;
    return () => { typingChannel.current = null; supabase.removeChannel(ch); };
  }, [active, uid]);

  function onInputChange(v: string) {
    setInput(v);
    const now = Date.now();
    if (typingChannel.current && now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      typingChannel.current.send({ type: "broadcast", event: "typing", payload: { user: uid } });
    }
  }

  async function send() {
    if (!input.trim() || !active) return;
    setBusy(true);
    const content = input.trim();
    setInput("");
    const { error } = await supabase.from("messages").insert({ conversation_id: active.id, sender_id: uid, content });
    if (error) { toast.error(error.message); setBusy(false); return; }
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", active.id);
    await notify({ userId: active.other.id, actorId: uid, type: "message", message: `sent you a message: ${content.slice(0, 60)}` });
    trackMission("message");
    setBusy(false);
    loadConvos(uid);
  }

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? convos.filter((c) => (c.other.full_name ?? "student").toLowerCase().includes(q) || (c.preview ?? "").toLowerCase().includes(q))
      : convos;
    return [...filtered].sort((a, b) => {
      const pa = pins.includes(a.id) ? 1 : 0;
      const pb = pins.includes(b.id) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
  }, [convos, query, pins]);

  return (
    <AppShell>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid h-[calc(100dvh-11rem)] min-h-[22rem] md:grid-cols-[240px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className={`${active ? "hidden md:flex" : "flex"} min-w-0 flex-col border-b border-border md:border-b-0 md:border-r`}>
            <div className="shrink-0 border-b p-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 shrink-0 text-primary" />
                <h1 className="min-w-0 truncate text-base font-black">Messages</h1>
                {convos.some((c) => (c.unread ?? 0) > 0) && (
                  <span className="ml-auto shrink-0 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                    {convos.reduce((s, c) => s + (c.unread ?? 0), 0)}
                  </span>
                )}
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-full border bg-background px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search chats"
                  aria-label="Search chats"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-6 text-sm text-muted-foreground">Loading…</p>
              ) : list.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No chats yet. Message a friend from their profile.</p>
              ) : (
                <ul>
                  {list.map((c) => {
                    const pinned = pins.includes(c.id);
                    return (
                      <li key={c.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 border-b px-1 ${active?.id === c.id ? "bg-muted" : ""}`}>
                        <Button variant="ghost"
                          onClick={() => { setActive(c); loadMessages(c.id, uid); }}
                          className="flex min-w-0 items-center gap-3 rounded-xl p-2.5 text-left hover:bg-muted"
                        >
                          <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {c.other.avatar_url
                              ? <img src={c.other.avatar_url} className="h-full w-full object-cover" alt="" loading="lazy" decoding="async" />
                              : (c.other.full_name || "S")[0]}
                            {c.other.is_online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-success" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              {pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                              <span className="truncate text-sm font-bold">{c.other.full_name || "Student"}</span>
                            </span>
                            <span className={`block truncate text-xs ${(c.unread ?? 0) > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                              {c.preview ?? "Say hi 👋"}
                            </span>
                          </span>
                          {(c.unread ?? 0) > 0 && (
                            <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">{c.unread}</span>
                          )}
                        </Button>
                        <Button variant="ghost"
                          onClick={() => togglePin(c.id)}
                          aria-label={pinned ? "Unpin chat" : "Pin chat"}
                          className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Thread */}
          <section className={`${active ? "flex" : "hidden md:flex"} min-w-0 flex-col`}>
            {!active ? (
              <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
                Pick a chat to start messaging.
              </div>
            ) : (
              <>
                <header className="flex shrink-0 items-center gap-2 border-b p-3">
                  <Button variant="ghost" onClick={() => setActive(null)} aria-label="Back to chats" className="rounded-full p-2 hover:bg-muted md:hidden">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Link to="/profile/$userId" params={{ userId: active.other.id }} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 hover:bg-muted">
                    <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {active.other.avatar_url
                        ? <img src={active.other.avatar_url} className="h-full w-full object-cover" alt="" loading="lazy" decoding="async" />
                        : (active.other.full_name || "S")[0]}
                      {active.other.is_online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{active.other.full_name || "Student"}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {otherTyping ? "typing…" : active.other.is_online ? "Online" : "Offline"}
                      </span>
                    </span>
                  </Link>
                </header>

                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 sm:p-4">
                  {msgs.map((m, i) => {
                    const mine = m.sender_id === uid;
                    const showDay = i === 0 || dayLabel((msgs[i - 1]?.created_at ?? m.created_at)) !== dayLabel(m.created_at);
                    return (
                      <div key={m.id} className="min-w-0">
                        {showDay && (
                          <p className="my-3 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{dayLabel(m.created_at)}</p>
                        )}
                        <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] min-w-0 rounded-2xl px-3.5 py-2 text-sm sm:max-w-[70%] ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted"}`}>
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            <span className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {mine && (m.read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {otherTyping && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl bg-muted px-3.5 py-2 text-xs text-muted-foreground">typing…</div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="flex shrink-0 items-center gap-2 border-t p-3">
                  <input
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Message…"
                    aria-label="Message"
                    className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                  />
                  <Button variant="ghost"
                    onClick={send}
                    disabled={busy || !input.trim()}
                    aria-label="Send message"
                    className="shrink-0 rounded-full bg-primary p-2.5 text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
