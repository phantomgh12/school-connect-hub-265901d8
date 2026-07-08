import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Search as SearchIcon, School, Hash, User as UserIcon } from "lucide-react";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/_authenticated/search")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Search — SchoolConnect" }] }),
  component: SearchPage,
});

function SearchPage() {
  const { q: initial } = Route.useSearch();
  const [q, setQ] = useState(initial ?? "");
  const [tab, setTab] = useState<"people" | "schools" | "posts" | "hashtags">("people");
  const [people, setPeople] = useState<any[]>([]);
  const [schools, setSchools] = useState<{ school_name: string; count: number }[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [hashtags, setHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (!query) { setPeople([]); setSchools([]); setPosts([]); setHashtags([]); return; }
    const cleaned = query.replace(/^#/, "");
    const t = setTimeout(async () => {
      setLoading(true);
      const [p, s, po] = await Promise.all([
        supabase.from("profiles").select("id,full_name,username,avatar_url,school_name").or(`full_name.ilike.%${cleaned}%,username.ilike.%${cleaned}%`).limit(20),
        supabase.from("profiles").select("school_name").ilike("school_name", `%${cleaned}%`).not("school_name", "is", null).limit(200),
        supabase.from("posts").select("id,user_id,content,media_urls,post_type,hashtags,created_at").or(`content.ilike.%${cleaned}%,hashtags.cs.{${cleaned.toLowerCase()}}`).order("created_at", { ascending: false }).limit(30),
      ]);
      setPeople(p.data ?? []);
      const schoolCounts: Record<string, number> = {};
      (s.data ?? []).forEach((r: any) => { if (r.school_name) schoolCounts[r.school_name] = (schoolCounts[r.school_name] ?? 0) + 1; });
      setSchools(Object.entries(schoolCounts).map(([school_name, count]) => ({ school_name, count })).sort((a, b) => b.count - a.count).slice(0, 20));
      setPosts(po.data ?? []);
      const tags: Record<string, number> = {};
      (po.data ?? []).forEach((row: any) => (row.hashtags ?? []).forEach((h: string) => { if (h.includes(cleaned.toLowerCase())) tags[h] = (tags[h] ?? 0) + 1; }));
      setHashtags(Object.entries(tags).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <AppShell>
      <div className="glass mb-4 rounded-3xl p-5">
        <h1 className="mb-3 text-xl font-black">Search</h1>
        <div className="flex items-center gap-2 rounded-full border bg-background/60 px-4 py-2.5">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students, schools, posts, #hashtags…" className="w-full bg-transparent text-sm outline-none" />
        </div>
      </div>

      <div className="glass mb-4 inline-flex rounded-full p-1">
        {(["people", "schools", "posts", "hashtags"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize ${tab === t ? "gradient-brand text-primary-foreground shadow-brand" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {loading && <div className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">Searching…</div>}
      {!loading && !q.trim() && <div className="glass rounded-3xl p-10 text-center text-sm text-muted-foreground">Type something to search across SchoolConnect.</div>}

      {!loading && q.trim() && tab === "people" && (
        <ul className="grid gap-2">
          {people.length === 0 && <li className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No students found.</li>}
          {people.map((p) => (
            <li key={p.id}>
              <Link to="/profile/$userId" params={{ userId: p.id }} className="glass flex items-center gap-3 rounded-2xl p-3 hover:bg-muted">
                <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full gradient-brand text-xs font-bold text-primary-foreground">
                  {p.avatar_url ? <img src={p.avatar_url} className="h-full w-full object-cover" alt="" /> : (p.full_name || "S")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.full_name || p.username || "Student"}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.school_name ?? ""}</div>
                </div>
                <UserIcon className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && q.trim() && tab === "schools" && (
        <ul className="grid gap-2">
          {schools.length === 0 && <li className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No schools found.</li>}
          {schools.map((s) => (
            <li key={s.school_name} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--brand)]/10 text-[color:var(--brand)]"><School className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{s.school_name}</div>
                <div className="text-xs text-muted-foreground">{s.count} student{s.count > 1 ? "s" : ""}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && q.trim() && tab === "posts" && (
        <ul className="grid gap-3">
          {posts.length === 0 && <li className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No matching posts.</li>}
          {posts.map((p) => (
            <li key={p.id} className="glass rounded-2xl p-4">
              <p className="text-sm">{p.content}</p>
              {(p.media_urls ?? []).length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {p.media_urls.slice(0, 4).map((u: string, i: number) => (
                    u.match(/\.(mp4|webm|mov)/i) ? <video key={i} src={u} className="h-32 w-full rounded-xl object-cover" /> : <img key={i} src={u} className="h-32 w-full rounded-xl object-cover" alt="" loading="lazy" />
                  ))}
                </div>
              )}
              <Link to="/home" hash={`post-${p.id}`} className="mt-2 inline-block text-xs font-semibold text-[color:var(--brand)] hover:underline">View post →</Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && q.trim() && tab === "hashtags" && (
        <ul className="grid gap-2">
          {hashtags.length === 0 && <li className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No hashtags found.</li>}
          {hashtags.map((h) => (
            <li key={h.tag} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--brand)]/10 text-[color:var(--brand)]"><Hash className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">#{h.tag}</div>
                <div className="text-xs text-muted-foreground">{h.count} post{h.count > 1 ? "s" : ""}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
