import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { MessageCircle, Send, ArrowLeft, Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";
import { toast } from "sonner";


const searchSchema = z.object({ with: z.string().optional() });

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Messages — SchoolConnect" }] }),
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

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
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
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadConvos(myId: string) {
    const { data: rows } = await supabase.from("conversations").select("*").or(`user_a.eq.${myId},user_b.eq.${myId}`).order("last_message_at", { ascending: false });
    const otherIds = (rows ?? []).map((c: any) => c.user_a === myId ? c.user_b : c.user_a);
    const { data: people } = otherIds.length
      ? await supabase.from("profiles").select("id,full_name,avatar_url,is_online").in("id", otherIds)
      : { data: [] as any[] };
    const pmap = new Map((people ?? []).map((p: any) => [p.id, p]));
    // last message previews (fetch last message per convo)
    const previews: Record<string, string> = {};
    const unreads: Record<string, number> = {};
    if ((rows ?? []).length) {
      const cIds = (rows ?? []).map((r: any) => r.id);
      const { data: lastMsgs } = await supabase.from("messages").select("conversation_id,content,sender_id,read").in("conversation_id", cIds).order("created_at", { ascending: false }).limit(200);
      lastMsgs?.forEach((m: any) => {
        if (!previews[m.conversation_id]) previews[m.conversation_id] = m.content;
        if (m.sender_id !== myId && !m.read) unreads[m.conversation_id] = (unreads[m.conversation_id] ?? 0) + 1;
      });
    }
    setConvos((rows ?? []).map((r: any) => ({
      id: r.id,
      other: pmap.get(r.user_a === myId ? r.user_b : r.user_a) ?? { id: r.user_a === myId ? r.user_b : r.user_a, full_name: null, avatar_url: null, is_online: false },
      last_message_at: r.last_message_at,
      preview: previews[r.id],
      unread: unreads[r.id] ?? 0,
    })));
  }

  async function openConversationWith(myId: string, otherId: string) {
    const [ua, ub] = orderedPair(myId, otherId);
    let { data: existing } = await supabase.from("conversations").select("*").eq("user_a", ua).eq("user_b", ub).maybeSingle();
    if (!existing) {
      const { data: created, error } = await supabase.from("conversations").insert({ user_a: ua, user_b: ub }).select("*").single();
      if (error) { toast.error(error.message); return; }
      existing = created;
    }
    const { data: other } = await supabase.from("profiles").select("id,full_name,avatar_url,is_online").eq("id", otherId).maybeSingle();
    const convo: Convo = { id: existing!.id, other: other ?? { id: otherId, full_name: null, avatar_url: null, is_online: false }, last_message_at: existing!.last_message_at };
    setActive(convo);
    await loadConvos(myId);
    await loadMessages(convo.id, myId);
  }

  async function loadMessages(convoId: string, myId: string) {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", convoId).order("created_at", { ascending: true });
    setMsgs(data ?? []);
    // mark unread received messages as read
    await supabase.from("messages").update({ read: true }).eq("conversation_id", convoId).neq("sender_id", myId).eq("read", false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

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
    // eslint-disable-next-line
  }, [targetUser]);

  // Realtime for active convo
  useEffect(() => {
    if (!active || !uid) return;
    const ch = supabase.channel(`msg-${active.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${active.id}` }, (payload: any) => {
        setMsgs((prev) => [...prev, payload.new]);
        if (payload.new.sender_id !== uid) {
          supabase.from("messages").update({ read: true }).eq("id", payload.new.id).then(() => {});
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active, uid]);

  async function send() {
    if (!input.trim() || !active) return;
    setBusy(true);
    const content = input.trim();
    setInput("");
    const { error } = await supabase.from("messages").insert({ conversation_id: active.id, sender_id: uid, content });
    if (error) { toast.error(error.message); setBusy(false); return; }
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", active.id);
    await notify({ userId: active.other.id, actorId: uid, type: "message", message: `sent you a message: ${content.slice(0, 60)}` });
    setBusy(false);
    loadConvos(uid);
  }

  return (
    <AppShell>
      <div className="glass overflow-hidden rounded-3xl">
        <div className="grid min-h-[70vh] md:grid-cols-[280px_minmax(0,1fr)]">
          {/* Convo list */}
          <aside className={`${active ? "hidden md:block" : "block"} border-r border-border/60`}>
            <div className="flex items-center gap-2 border-b border-border/60 p-4">
              <MessageCircle className="h-5 w-5 text-[color:var(--brand)]" />
              <h2 className="text-lg font-black">Chats</h2>
            </div>
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : convos.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No chats yet. Message a friend from their profile.</div>
            ) : (
              <ul className="max-h-[65vh] overflow-y-auto">
                {convos.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => { setActive(c); loadMessages(c.id, uid); }} className={`flex w-full items-center gap-3 border-b border-border/60 p-3 text-left hover:bg-muted ${active?.id === c.id ? "bg-muted" : ""}`}>
                      <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-xs font-bold text-primary-foreground">
                        {c.other.avatar_url ? <img src={c.other.avatar_url} className="h-full w-full object-cover" alt="" /> : (c.other.full_name || "S")[0]}
                        {c.other.is_online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{c.other.full_name || "Student"}</div>
                        <div className="truncate text-xs text-muted-foreground">{c.preview ?? "Say hi 👋"}</div>
                      </div>
                      {c.unread! > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* Chat */}
          <section className={`${active ? "flex" : "hidden md:flex"} flex-col`}>
            {!active ? (
              <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
                Pick a chat to start messaging.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-border/60 p-3">
                  <button onClick={() => setActive(null)} className="rounded-full p-1.5 hover:bg-muted md:hidden"><ArrowLeft className="h-4 w-4" /></button>
                  <Link to="/profile/$userId" params={{ userId: active.other.id }} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
                    <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full gradient-brand text-xs font-bold text-primary-foreground">
                      {active.other.avatar_url ? <img src={active.other.avatar_url} className="h-full w-full object-cover" alt="" /> : (active.other.full_name || "S")[0]}
                      {active.other.is_online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold hover:underline">{active.other.full_name || "Student"}</div>
                      <div className="text-[11px] text-muted-foreground">{active.other.is_online ? "Online" : "Offline"}</div>
                    </div>
                  </Link>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {msgs.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_id === uid ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === uid ? "gradient-brand text-primary-foreground shadow-brand" : "bg-muted"}`}>
                        {m.content}
                        <div className={`mt-0.5 text-[10px] ${m.sender_id === uid ? "text-white/80" : "text-muted-foreground"}`}>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <div className="flex gap-2 border-t border-border/60 p-3">
                  <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message…" className="flex-1 rounded-full border bg-background/60 px-4 py-2 text-sm outline-none" />
                  <button onClick={send} disabled={busy || !input.trim()} className="rounded-full gradient-brand p-2 text-primary-foreground shadow-brand disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
