import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { SkeletonCard } from "@/components/app/Skeletons";

export const Route = createFileRoute("/_authenticated/communities/$slug")({
  head: () => ({
    meta: [
      { title: "School community — SchoolConnect" },
      { name: "description", content: "Members, events and announcements for this school community." },
      { property: "og:title", content: "School community — SchoolConnect" },
      { property: "og:description", content: "Members, events and announcements for this school." },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const { slug } = Route.useParams();
  const [members, setMembers] = useState<any[] | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: e }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,username,avatar_url,grade_class,verified").eq("school_slug", slug).limit(60),
        supabase.from("school_events").select("id,title,starts_at,location").eq("school_slug", slug).order("starts_at").limit(10),
      ]);
      setMembers(m ?? []);
      setEvents(e ?? []);
    })();
  }, [slug]);

  const name = members?.length ? slug.replace(/-/g, " ") : slug.replace(/-/g, " ");

  return (
    <AppShell>
      <header className="glass rounded-2xl p-5">
        <h1 className="truncate text-xl font-black capitalize">{name}</h1>
        <p className="text-sm text-muted-foreground">{members?.length ?? 0} members · {events.length} events</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/events" className="press rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground">Events</Link>
          <Link to="/confessions" className="press rounded-full border px-3.5 py-1.5 text-xs font-bold hover:bg-muted">Confessions</Link>
          <Link to="/leaderboards" className="press rounded-full border px-3.5 py-1.5 text-xs font-bold hover:bg-muted">Leaderboard</Link>
        </div>
      </header>

      <section className="mt-4 grid gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Directory</h2>
        {!members ? <SkeletonCard /> : members.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <ul className="glass grid gap-3 rounded-2xl p-4">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Link to="/profile/$userId" params={{ userId: m.id }} className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : (m.full_name || "S")[0]}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to="/profile/$userId" params={{ userId: m.id }} className="block truncate text-sm font-semibold hover:underline">{m.full_name || m.username || "Student"}</Link>
                  <div className="truncate text-xs text-muted-foreground">{m.grade_class ?? "Student"}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
