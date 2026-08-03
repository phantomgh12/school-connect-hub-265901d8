import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { SkeletonCard } from "@/components/app/Skeletons";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({
    meta: [
      { title: "School Events & Calendar — SchoolConnect" },
      { name: "description", content: "See what's coming up at your school, create events and RSVP with your classmates." },
      { property: "og:title", content: "School Events & Calendar — SchoolConnect" },
      { property: "og:description", content: "Upcoming school events and RSVPs." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const [uid, setUid] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [events, setEvents] = useState<any[] | null>(null);
  const [rsvps, setRsvps] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ title: "", starts_at: "", location: "", description: "" });
  const [saving, setSaving] = useState(false);

  async function load(id: string) {
    const [{ data: e }, { data: r }] = await Promise.all([
      supabase.from("school_events").select("id,title,description,location,starts_at,created_by,school_slug").order("starts_at").limit(50),
      supabase.from("event_rsvps").select("event_id").eq("user_id", id),
    ]);
    setEvents(e ?? []);
    setRsvps(new Set((r ?? []).map((x: any) => x.event_id)));
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      const { data: p } = await supabase.from("profiles").select("school_slug").eq("id", u.user.id).maybeSingle();
      setSlug(p?.school_slug ?? null);
      await load(u.user.id);
    })();
  }, []);

  async function create() {
    if (!form.title.trim() || !form.starts_at) return toast.error("Add a title and a date");
    setSaving(true);
    const { error } = await supabase.from("school_events").insert({
      created_by: uid, school_slug: slug, title: form.title.trim(),
      description: form.description || null, location: form.location || null,
      starts_at: new Date(form.starts_at).toISOString(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setForm({ title: "", starts_at: "", location: "", description: "" });
    toast.success("Event created");
    supabase.rpc("award_xp", { _amount: 25, _reason: "create_event" }).then(() => {});
    load(uid);
  }

  async function toggleRsvp(eventId: string) {
    if (rsvps.has(eventId)) {
      await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", uid);
    } else {
      await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: uid });
    }
    load(uid);
  }

  return (
    <AppShell>
      <header className="glass flex items-center gap-3 rounded-2xl p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary"><CalendarDays className="h-5 w-5 text-primary-foreground" /></span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">Events & calendar</h1>
          <p className="text-sm text-muted-foreground">What's coming up at your school.</p>
        </div>
      </header>

      <section className="glass mt-4 grid gap-2 rounded-2xl p-5">
        <h2 className="text-sm font-bold">Create an event</h2>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full rounded-xl border bg-card px-3 py-2 text-sm" />
        <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="w-full rounded-xl border bg-card px-3 py-2 text-sm" />
        <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location (optional)" className="w-full rounded-xl border bg-card px-3 py-2 text-sm" />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Details (optional)" rows={2} className="w-full rounded-xl border bg-card px-3 py-2 text-sm" />
        <button onClick={create} disabled={saving} className="press mt-1 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">{saving ? "Creating…" : "Create event"}</button>
      </section>

      <div className="mt-4 grid gap-3">
        {!events ? [0, 1].map((i) => <SkeletonCard key={i} lines={1} />) : events.length === 0 ? (
          <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No events yet — create the first one.</p>
        ) : events.map((e) => (
          <article key={e.id} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-bold">{e.title}</h3>
                <p className="truncate text-xs text-muted-foreground">{new Date(e.starts_at).toLocaleString()}{e.location ? ` · ${e.location}` : ""}</p>
              </div>
              <button onClick={() => toggleRsvp(e.id)} className={`press shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${rsvps.has(e.id) ? "bg-[color:var(--success)] text-[color:var(--success-foreground)]" : "border hover:bg-muted"}`}>
                {rsvps.has(e.id) ? "Going" : "RSVP"}
              </button>
            </div>
            {e.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{e.description}</p>}
          </article>
        ))}
      </div>
    </AppShell>
  );
}
