import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { useTheme } from "@/lib/theme";
import { Settings as Cog, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SchoolConnect" },
      { name: "description", content: "Manage your appearance, interests and account settings on SchoolConnect." },
      { property: "og:title", content: "Settings — SchoolConnect" },
      { property: "og:description", content: "Appearance, interests and account." },
    ],
  }),
  component: SettingsPage,
});

const INTERESTS = ["football", "music", "coding", "science", "maths", "art", "movies", "fashion", "gaming", "business", "debate", "athletics"];

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const [uid, setUid] = useState("");
  const [mine, setMine] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      const { data } = await supabase.from("user_interests").select("interest").eq("user_id", u.user.id);
      setMine(new Set((data ?? []).map((i: any) => i.interest)));
    })();
  }, []);

  async function toggleInterest(tag: string) {
    if (mine.has(tag)) {
      await supabase.from("user_interests").delete().eq("user_id", uid).eq("interest", tag);
      setMine((s) => { const n = new Set(s); n.delete(tag); return n; });
    } else {
      const { error } = await supabase.from("user_interests").insert({ user_id: uid, interest: tag });
      if (error) return toast.error(error.message);
      setMine((s) => new Set(s).add(tag));
    }
  }

  return (
    <AppShell>
      <header className="glass flex items-center gap-3 rounded-2xl p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary"><Cog className="h-5 w-5 text-primary-foreground" /></span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">Settings</h1>
          <p className="text-sm text-muted-foreground">Appearance, interests and account.</p>
        </div>
      </header>

      <section className="glass mt-4 flex items-center justify-between gap-3 rounded-2xl p-5">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">Appearance</h2>
          <p className="text-xs text-muted-foreground">Currently {theme} mode</p>
        </div>
        <button onClick={toggle} className="press inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-bold hover:bg-muted">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} Switch
        </button>
      </section>

      <section className="glass mt-4 rounded-2xl p-5">
        <h2 className="text-sm font-bold">Your interests</h2>
        <p className="text-xs text-muted-foreground">These tune your For You feed and friend recommendations.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERESTS.map((t) => (
            <button key={t} onClick={() => toggleInterest(t)} className={`press rounded-full px-3 py-1.5 text-xs font-bold capitalize ${mine.has(t) ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}>{t}</button>
          ))}
        </div>
      </section>

      <section className="glass mt-4 grid gap-2 rounded-2xl p-5 text-sm">
        <h2 className="text-sm font-bold">Account</h2>
        <Link to="/profile" className="rounded-xl px-2 py-2 font-semibold hover:bg-muted">Edit profile</Link>
        <Link to="/verification" className="rounded-xl px-2 py-2 font-semibold hover:bg-muted">Verification & invites</Link>
        <Link to="/saved" className="rounded-xl px-2 py-2 font-semibold hover:bg-muted">Saved posts</Link>
      </section>
    </AppShell>
  );
}
