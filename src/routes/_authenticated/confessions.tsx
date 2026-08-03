import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { SkeletonCard } from "@/components/app/Skeletons";
import { MessageSquareDashed, ShieldCheck, Flag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/confessions")({
  head: () => ({
    meta: [
      { title: "Anonymous School Confessions — SchoolConnect" },
      { name: "description", content: "Share anonymously with your school. Every confession is filtered for abuse and approved by moderators before it appears." },
      { property: "og:title", content: "Anonymous School Confessions — SchoolConnect" },
      { property: "og:description", content: "Anonymous, moderated, bullying-free." },
    ],
  }),
  component: ConfessionsPage,
});

function ConfessionsPage() {
  const [uid, setUid] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [sending, setSending] = useState(false);

  async function load() {
    const { data } = await supabase.from("confessions").select("id,content,created_at,school_slug,likes_count")
      .eq("status", "approved").order("created_at", { ascending: false }).limit(50);
    setRows(data ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      const { data: p } = await supabase.from("profiles").select("school_slug").eq("id", u.user.id).maybeSingle();
      setSlug(p?.school_slug ?? null);
      await load();
    })();
    const ch = supabase.channel("confessions").on("postgres_changes", { event: "*", schema: "public", table: "confessions" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function submit() {
    if (text.trim().length < 10) return toast.error("Write at least 10 characters");
    setSending(true);
    const { error } = await supabase.from("confessions").insert({ author_id: uid, school_slug: slug, content: text.trim() });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
    toast.success("Sent for review — it appears once a moderator approves it.");
  }

  async function report(id: string) {
    const { error } = await supabase.from("reports").insert({ reporter_id: uid, target_type: "confession", target_id: id, reason: "abuse" });
    if (error) return toast.error(error.message);
    toast.success("Reported. Thank you.");
  }

  return (
    <AppShell>
      <header className="glass flex items-center gap-3 rounded-2xl p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary"><MessageSquareDashed className="h-5 w-5 text-primary-foreground" /></span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">Anonymous confessions</h1>
          <p className="text-sm text-muted-foreground">Fully anonymous. Never shows who posted.</p>
        </div>
      </header>

      <div className="glass mt-4 flex items-start gap-2 rounded-2xl p-4 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--success)]" />
        <p>Profanity, spam and targeted attacks are auto-blocked, and a moderator approves every confession before it appears. Bullying gets you banned.</p>
      </div>

      <section className="glass mt-4 grid gap-2 rounded-2xl p-5">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1000}
          placeholder="Say it anonymously… be kind, no names." className="w-full resize-none rounded-xl border bg-card px-3 py-2 text-sm" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{text.length}/1000</span>
          <button onClick={submit} disabled={sending} className="press rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">{sending ? "Sending…" : "Send anonymously"}</button>
        </div>
      </section>

      <div className="mt-4 grid gap-3">
        {!rows ? [0, 1].map((i) => <SkeletonCard key={i} lines={1} />) : rows.length === 0 ? (
          <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No approved confessions yet.</p>
        ) : rows.map((c) => (
          <article key={c.id} className="glass rounded-2xl p-4">
            <p className="whitespace-pre-wrap break-words text-sm">{c.content}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Anonymous · {new Date(c.created_at).toLocaleDateString()}</span>
              <button onClick={() => report(c.id)} className="press inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold hover:bg-muted"><Flag className="h-3 w-3" /> Report</button>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
